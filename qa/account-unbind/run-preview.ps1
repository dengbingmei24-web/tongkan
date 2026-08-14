[CmdletBinding()]
param(
  [Uri]$ApiOrigin = "https://account-preview.tongkan-personal.pages.dev/account-api",
  [string]$CasesPath = "",
  [ValidateSet("ValidateOnly", "Live")]
  [string]$Mode = "ValidateOnly",
  [string[]]$CaseId = @(),
  [switch]$SecureStdin,
  [ValidateRange(1, 120)]
  [int]$TimeoutSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

if ([string]::IsNullOrWhiteSpace($CasesPath)) {
  $CasesPath = Join-Path $PSScriptRoot "contract-cases.json"
}

function Assert-PreviewOrigin {
  param([Uri]$Origin)

  if (-not $Origin.IsAbsoluteUri) {
    throw "ApiOrigin must be an absolute URI."
  }

  $hostName = $Origin.DnsSafeHost.ToLowerInvariant()
  $isLocal = $hostName -eq "localhost" -or $hostName -eq "127.0.0.1" -or $hostName -eq "::1"
  $isPreview = $hostName.Contains("preview")
  if (-not $isLocal -and -not $isPreview) {
    throw "Non-preview API origin refused; this W3 script has no production override."
  }

  if (-not $isLocal -and $Origin.Scheme -ne "https") {
    throw "Remote preview API must use HTTPS."
  }
}

function Read-SecureText {
  param([string]$Prompt)

  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Get-SecretValue {
  param(
    [string]$Name,
    [string]$Prompt,
    [bool]$Required
  )

  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value) -and $SecureStdin) {
    $value = Read-SecureText -Prompt $Prompt
  }
  if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
    throw "Missing secure input $Name; use a process environment variable or -SecureStdin."
  }
  return $value
}

function Resolve-TemplateString {
  param([string]$Value)

  return [regex]::Replace($Value, "\{\{([A-Z0-9_]+)\}\}", {
    param($match)
    $name = $match.Groups[1].Value
    if ($name -match "TOKEN|TEST_KEY") {
      throw "Contract placeholders must not reference tokens or test keys."
    }
    $resolved = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrWhiteSpace($resolved)) {
      throw "Missing case environment variable $name."
    }
    return $resolved
  })
}

function Resolve-TemplateValue {
  param($Value)

  if ($null -eq $Value) { return $null }
  if ($Value -is [string]) { return Resolve-TemplateString -Value $Value }
  if ($Value -is [System.Collections.IDictionary]) {
    $result = @{}
    foreach ($key in $Value.Keys) {
      $result[$key] = Resolve-TemplateValue -Value $Value[$key]
    }
    return $result
  }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
    return @($Value | ForEach-Object { Resolve-TemplateValue -Value $_ })
  }
  if ($Value -is [pscustomobject]) {
    $result = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) {
      $result[$property.Name] = Resolve-TemplateValue -Value $property.Value
    }
    return [pscustomobject]$result
  }
  return $Value
}

function Get-BodyPathValue {
  param($Body, [string]$Path)

  $current = $Body
  foreach ($segment in $Path.Split(".")) {
    if ($null -eq $current) { return $null }
    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) { return $null }
    $current = $property.Value
  }
  return $current
}

function Test-EqualValue {
  param($Actual, $Expected)

  if ($null -eq $Expected) { return $null -eq $Actual }
  if ($null -eq $Actual) { return $false }
  return (ConvertTo-Json $Actual -Compress -Depth 20) -ceq (ConvertTo-Json $Expected -Compress -Depth 20)
}

function New-CaseRequest {
  param(
    [System.Net.Http.HttpClient]$Client,
    [pscustomobject]$Definition,
    [string]$TokenA,
    [string]$TokenB,
    [string]$TestKey
  )

  $path = Resolve-TemplateString -Value ([string]$Definition.path)
  $base = $ApiOrigin.AbsoluteUri.TrimEnd("/")
  $target = [Uri]("$base/$($path.TrimStart('/'))")
  $message = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new(([string]$Definition.method).ToUpperInvariant()), $target)

  $actor = ([string]$Definition.actor).ToUpperInvariant()
  $token = if ($actor -eq "A") { $TokenA } elseif ($actor -eq "B") { $TokenB } else { $null }
  if (-not [string]::IsNullOrWhiteSpace($token)) {
    $message.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $token)
  }
  if (-not [string]::IsNullOrWhiteSpace($TestKey)) {
    [void]$message.Headers.TryAddWithoutValidation("X-Tongkan-Test-Key", $TestKey)
  }

  if ($Definition.PSObject.Properties.Name -contains "body") {
    $resolvedBody = Resolve-TemplateValue -Value $Definition.body
    $json = ConvertTo-Json $resolvedBody -Compress -Depth 20
    $message.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, "application/json")
  }

  return $message
}

function Complete-CaseResponse {
  param([pscustomobject]$Definition, [System.Net.Http.HttpResponseMessage]$Response)

  $content = $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $body = $null
  if (-not [string]::IsNullOrWhiteSpace($content)) {
    try { $body = $content | ConvertFrom-Json } catch { $body = $null }
  }
  return [pscustomobject]@{
    Name = [string]$Definition.name
    Status = [int]$Response.StatusCode
    ErrorCode = if ($null -ne $body -and $body.PSObject.Properties.Name -contains "error") { [string]$body.error } else { $null }
    Body = $body
  }
}

function Assert-RequestResult {
  param([pscustomobject]$Definition, [pscustomobject]$Result)

  $expectedStatuses = @($Definition.expect.statuses | ForEach-Object { [int]$_ })
  if ($expectedStatuses -notcontains $Result.Status) {
    throw "$($Definition.name): HTTP $($Result.Status) is outside the expected status set."
  }
  if ($Definition.expect.PSObject.Properties.Name -contains "error") {
    if ($Result.ErrorCode -cne [string]$Definition.expect.error) {
      throw "$($Definition.name): unexpected error code $($Result.ErrorCode)."
    }
  }
  if ($Definition.expect.PSObject.Properties.Name -contains "body") {
    foreach ($assertion in $Definition.expect.body.PSObject.Properties) {
      $expected = Resolve-TemplateValue -Value $assertion.Value
      $actual = Get-BodyPathValue -Body $Result.Body -Path $assertion.Name
      if (-not (Test-EqualValue -Actual $actual -Expected $expected)) {
        throw "$($Definition.name): response field $($assertion.Name) violates the contract."
      }
    }
  }
}

function Assert-AggregateResult {
  param([pscustomobject]$Expectation, [object[]]$Results)

  if ($Expectation.PSObject.Properties.Name -contains "statusCounts") {
    foreach ($entry in $Expectation.statusCounts.PSObject.Properties) {
      $actualCount = @($Results | Where-Object { $_.Status -eq [int]$entry.Name }).Count
      if ($actualCount -ne [int]$entry.Value) {
        throw "Parallel HTTP $($entry.Name) count expected $($entry.Value), actual $actualCount."
      }
    }
  }
  if ($Expectation.PSObject.Properties.Name -contains "errorCounts") {
    foreach ($entry in $Expectation.errorCounts.PSObject.Properties) {
      $actualCount = @($Results | Where-Object { $_.ErrorCode -ceq $entry.Name }).Count
      if ($actualCount -ne [int]$entry.Value) {
        throw "Parallel error $($entry.Name) count expected $($entry.Value), actual $actualCount."
      }
    }
  }
}

function Assert-ContractShape {
  param([pscustomobject]$Contract)

  if ([int]$Contract.schemaVersion -ne 1) { throw "Unsupported contract schemaVersion." }
  $ids = @{}
  foreach ($case in @($Contract.cases)) {
    if ([string]::IsNullOrWhiteSpace([string]$case.id)) { throw "Case id is required." }
    if ($ids.ContainsKey([string]$case.id)) { throw "Duplicate case id." }
    $ids[[string]$case.id] = $true
    if (@("sequential", "parallel") -notcontains [string]$case.mode) { throw "$($case.id): invalid mode." }
    foreach ($request in @($case.requests)) {
      if (@("A", "B", "none") -notcontains [string]$request.actor) { throw "$($case.id): invalid actor." }
      if (@("GET", "POST") -notcontains ([string]$request.method).ToUpperInvariant()) { throw "$($case.id): invalid method." }
      $serialized = ConvertTo-Json $request -Compress -Depth 20
      if ($serialized -match "\{\{[^}]*(TOKEN|TEST_KEY)[^}]*\}\}") { throw "$($case.id): secret placeholders are forbidden." }
    }
  }
}

Assert-PreviewOrigin -Origin $ApiOrigin
if (-not (Test-Path -LiteralPath $CasesPath -PathType Leaf)) { throw "Contract file not found." }
$contract = Get-Content -LiteralPath $CasesPath -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-ContractShape -Contract $contract

$selectedCases = @($contract.cases)
if ($CaseId.Count -gt 0) {
  $selectedCases = @($selectedCases | Where-Object { $CaseId -contains [string]$_.id })
  $unknown = @($CaseId | Where-Object { $_ -notin @($selectedCases | ForEach-Object { [string]$_.id }) })
  if ($unknown.Count -gt 0) { throw "Unknown case id." }
}

if ($Mode -eq "ValidateOnly") {
  Write-Host "Contract validation passed: $($selectedCases.Count) cases; no network request sent."
  exit 0
}

$actors = @($selectedCases.requests.actor | ForEach-Object { [string]$_ } | Select-Object -Unique)
$tokenA = Get-SecretValue -Name "TONGKAN_QA_TOKEN_A" -Prompt "Token A" -Required ($actors -contains "A")
$tokenB = Get-SecretValue -Name "TONGKAN_QA_TOKEN_B" -Prompt "Token B" -Required ($actors -contains "B")
$testKey = Get-SecretValue -Name "TONGKAN_QA_TEST_KEY" -Prompt "Preview test key (optional)" -Required $false

$handler = [System.Net.Http.HttpClientHandler]::new()
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
$failed = $false
$currentCaseId = "initialization"
try {
  foreach ($case in $selectedCases) {
    $currentCaseId = [string]$case.id
    foreach ($name in @($case.requiredEnvironment)) {
      if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable([string]$name, "Process"))) {
        throw "$($case.id): missing non-secret environment variable $name."
      }
    }

    $results = @()
    if ([string]$case.mode -eq "parallel") {
      $pending = @()
      foreach ($definition in @($case.requests)) {
        $message = New-CaseRequest -Client $client -Definition $definition -TokenA $tokenA -TokenB $tokenB -TestKey $testKey
        $pending += [pscustomobject]@{ Definition = $definition; Message = $message; Task = $client.SendAsync($message) }
      }
      foreach ($item in $pending) {
        $response = $item.Task.GetAwaiter().GetResult()
        try { $results += Complete-CaseResponse -Definition $item.Definition -Response $response } finally { $response.Dispose(); $item.Message.Dispose() }
      }
    } else {
      foreach ($definition in @($case.requests)) {
        $message = New-CaseRequest -Client $client -Definition $definition -TokenA $tokenA -TokenB $tokenB -TestKey $testKey
        try {
          $response = $client.SendAsync($message).GetAwaiter().GetResult()
          try { $results += Complete-CaseResponse -Definition $definition -Response $response } finally { $response.Dispose() }
        } finally { $message.Dispose() }
      }
    }

    foreach ($index in 0..($results.Count - 1)) {
      Assert-RequestResult -Definition @($case.requests)[$index] -Result $results[$index]
      Write-Host "PASS $($case.id)/$($results[$index].Name) HTTP $($results[$index].Status) $($results[$index].ErrorCode)"
    }
    if ($case.PSObject.Properties.Name -contains "aggregateExpect") {
      Assert-AggregateResult -Expectation $case.aggregateExpect -Results $results
    }
  }
} catch {
  $failed = $true
  Write-Error "Case $currentCaseId failed ($($_.Exception.GetType().Name)); request and response data omitted."
} finally {
  $client.Dispose()
  $handler.Dispose()
  $tokenA = $null
  $tokenB = $null
  $testKey = $null
}

if ($failed) { exit 1 }
Write-Host "Preview contract passed: $($selectedCases.Count) cases."
