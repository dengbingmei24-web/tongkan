[CmdletBinding()]
param(
  [Uri]$ApiOrigin = "https://tongkan-account-preview-gateway.pages.dev/account-api",
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

$AllowedRemotePreviewHosts = @("tongkan-account-preview-gateway.pages.dev")
$ExpectedErrorContract = [ordered]@{
  "400" = @("INVALID_REQUEST", "INVALID_JSON")
  "415" = @("JSON_REQUIRED")
  "401" = @("AUTH_REQUIRED")
  "403" = @("ARCHIVE_FORBIDDEN")
  "404" = @("NOT_FOUND")
  "409" = @("PAIR_REQUIRED", "LIBRARY_VERSION_CONFLICT", "CATEGORY_NAME_CONFLICT", "LIBRARY_LIMIT_REACHED")
}
$ExpectedBatchErrorCodes = @("INVALID_BILIBILI_URL", "B23_RESOLUTION_FAILED", "CATEGORY_NOT_FOUND", "LIBRARY_LIMIT_REACHED")

if ([string]::IsNullOrWhiteSpace($CasesPath)) {
  $CasesPath = Join-Path $PSScriptRoot "contract-cases.json"
}

function Test-IsLocalOrigin {
  param([Uri]$Origin)
  $hostName = $Origin.DnsSafeHost.ToLowerInvariant()
  return $hostName -eq "localhost" -or $hostName -eq "127.0.0.1"
}

function Assert-PreviewOrigin {
  param([Uri]$Origin)
  if (-not $Origin.IsAbsoluteUri) { throw "ApiOrigin must be an absolute URI." }
  $hostName = $Origin.DnsSafeHost.ToLowerInvariant()
  if (Test-IsLocalOrigin -Origin $Origin) {
    if (@("http", "https") -notcontains $Origin.Scheme) { throw "Local preview API must use HTTP or HTTPS." }
    return
  }
  if ($Origin.Scheme -ne "https") { throw "Remote preview API must use HTTPS." }
  if ($AllowedRemotePreviewHosts -notcontains $hostName) { throw "Remote API origin is not in the exact preview allowlist." }
}

function Read-SecureText {
  param([string]$Prompt)
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Get-SecretValue {
  param([string]$Name, [string]$Prompt, [bool]$Required)
  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ($Required -and [string]::IsNullOrWhiteSpace($value) -and $SecureStdin) {
    $value = Read-SecureText -Prompt $Prompt
  }
  if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
    throw "Missing secure input $Name; use a process environment variable or -SecureStdin."
  }
  return $value
}

function Get-BodyPathInfo {
  param($Body, [string]$Path)
  $current = $Body
  if ([string]::IsNullOrWhiteSpace($Path)) { return [pscustomobject]@{ Exists = $true; Value = $current } }
  foreach ($segment in $Path.Split(".")) {
    if ($null -eq $current) { return [pscustomobject]@{ Exists = $false; Value = $null } }
    if ($current -is [System.Collections.IList] -and $current -isnot [string]) {
      $index = 0
      if (-not [int]::TryParse($segment, [ref]$index) -or $index -lt 0 -or $index -ge $current.Count) {
        return [pscustomobject]@{ Exists = $false; Value = $null }
      }
      $current = $current[$index]
      continue
    }
    if ($current -is [System.Collections.IDictionary]) {
      if (-not $current.Contains($segment)) { return [pscustomobject]@{ Exists = $false; Value = $null } }
      $current = $current[$segment]
      continue
    }
    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) { return [pscustomobject]@{ Exists = $false; Value = $null } }
    $current = $property.Value
  }
  return [pscustomobject]@{ Exists = $true; Value = $current }
}

function Resolve-Placeholder {
  param([string]$Name, [hashtable]$State, [int]$Iteration)
  if ($Name -match "TOKEN|TEST_KEY") { throw "Contract placeholders must not reference tokens or test keys." }
  if ($Name -eq "ITERATION") { return $Iteration }
  if ($State.ContainsKey($Name)) { return $State[$Name] }
  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) { throw "Missing template value $Name." }
  return $value
}

function Resolve-TemplateString {
  param([string]$Value, [hashtable]$State, [int]$Iteration)
  $exact = [regex]::Match($Value, "^\{\{([A-Z0-9_]+)\}\}$")
  if ($exact.Success) { return Resolve-Placeholder -Name $exact.Groups[1].Value -State $State -Iteration $Iteration }
  return [regex]::Replace($Value, "\{\{([A-Z0-9_]+)\}\}", {
    param($match)
    $resolved = Resolve-Placeholder -Name $match.Groups[1].Value -State $State -Iteration $Iteration
    return [Convert]::ToString($resolved, [System.Globalization.CultureInfo]::InvariantCulture)
  })
}

function Resolve-TemplateValue {
  param($Value, [hashtable]$State, [int]$Iteration)
  if ($null -eq $Value) { return $null }
  if ($Value -is [string]) { return Resolve-TemplateString -Value $Value -State $State -Iteration $Iteration }
  if ($Value -is [System.Collections.IDictionary]) {
    $result = [ordered]@{}
    foreach ($key in $Value.Keys) { $result[$key] = Resolve-TemplateValue -Value $Value[$key] -State $State -Iteration $Iteration }
    return $result
  }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string] -and $Value -isnot [pscustomobject]) {
    return ,@($Value | ForEach-Object { Resolve-TemplateValue -Value $_ -State $State -Iteration $Iteration })
  }
  if ($Value -is [pscustomobject]) {
    $result = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) {
      $result[$property.Name] = Resolve-TemplateValue -Value $property.Value -State $State -Iteration $Iteration
    }
    return [pscustomobject]$result
  }
  return $Value
}

function Test-EqualValue {
  param($Actual, $Expected)
  if ($null -eq $Expected) { return $null -eq $Actual }
  if ($null -eq $Actual) { return $false }
  return (ConvertTo-Json $Actual -Compress -Depth 30) -ceq (ConvertTo-Json $Expected -Compress -Depth 30)
}

function Get-OptionalValue {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $Default }
  return $property.Value
}

function Add-CaseRecursive {
  param([string]$Id, [hashtable]$CaseById, [hashtable]$Visiting, [hashtable]$Selected, [System.Collections.ArrayList]$Ordered)
  if ($Selected.ContainsKey($Id)) { return }
  if ($Visiting.ContainsKey($Id)) { throw "Case dependency cycle includes $Id." }
  if (-not $CaseById.ContainsKey($Id)) { throw "Unknown case id $Id." }
  $Visiting[$Id] = $true
  $case = $CaseById[$Id]
  foreach ($dependency in @(Get-OptionalValue -Object $case -Name "dependsOn" -Default @())) {
    Add-CaseRecursive -Id ([string]$dependency) -CaseById $CaseById -Visiting $Visiting -Selected $Selected -Ordered $Ordered
  }
  $Visiting.Remove($Id)
  $Selected[$Id] = $true
  [void]$Ordered.Add($case)
}

function Resolve-SelectedCases {
  param([pscustomobject]$Contract, [string[]]$RequestedIds)
  $caseById = @{}
  foreach ($case in @($Contract.cases)) { $caseById[[string]$case.id] = $case }
  $targets = if ($RequestedIds.Count -gt 0) { $RequestedIds } else { @($Contract.cases | ForEach-Object { [string]$_.id }) }
  $selected = @{}
  $ordered = [System.Collections.ArrayList]::new()
  foreach ($id in $targets) { Add-CaseRecursive -Id $id -CaseById $caseById -Visiting @{} -Selected $selected -Ordered $ordered }
  return @($ordered)
}

function Assert-StringSetEqual {
  param([string[]]$Actual, [string[]]$Expected, [string]$Label)
  $actualJson = ConvertTo-Json @($Actual | Sort-Object) -Compress
  $expectedJson = ConvertTo-Json @($Expected | Sort-Object) -Compress
  if ($actualJson -cne $expectedJson) { throw "$Label does not match the frozen contract." }
}

function Assert-RequestDefinition {
  param([pscustomobject]$Request, [string]$CaseId)
  if ([string]::IsNullOrWhiteSpace([string]$Request.name)) { throw "${CaseId}: request name is required." }
  if (@("A", "B", "C", "none") -notcontains [string]$Request.actor) { throw "$CaseId/$($Request.name): invalid actor." }
  if (@("GET", "POST", "PATCH", "DELETE") -notcontains ([string]$Request.method).ToUpperInvariant()) { throw "$CaseId/$($Request.name): invalid method." }
  $path = [string]$Request.path
  if (-not $path.StartsWith("/api/", [System.StringComparison]::Ordinal) -or $path.StartsWith("//", [System.StringComparison]::Ordinal)) {
    throw "$CaseId/$($Request.name): path must be a relative /api/ path."
  }
  if ($Request.PSObject.Properties.Name -contains "headers") { throw "$CaseId/$($Request.name): custom headers are forbidden." }
  if (($Request.PSObject.Properties.Name -contains "body") -and ($Request.PSObject.Properties.Name -contains "rawBody")) {
    throw "$CaseId/$($Request.name): body and rawBody are mutually exclusive."
  }
  $serialized = ConvertTo-Json $Request -Compress -Depth 30
  if ($serialized -match "\{\{[^}]*(TOKEN|TEST_KEY)[^}]*\}\}") { throw "$CaseId/$($Request.name): secret placeholders are forbidden." }
  if ($serialized -match "(?i)authorization\s*[:=]|bearer\s+[A-Za-z0-9._-]+|BEGIN PRIVATE KEY|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}") {
    throw "$CaseId/$($Request.name): possible credential or personal data found."
  }
}

function Assert-ContractShape {
  param([pscustomobject]$Contract, [string]$RawContract)
  if ([int]$Contract.schemaVersion -ne 1) { throw "Unsupported contract schemaVersion." }
  if ([string]$Contract.feature -ne "TK-003-shared-library") { throw "Unexpected contract feature." }
  if ($RawContract -match "(?i)BEGIN PRIVATE KEY|bearer\s+[A-Za-z0-9._-]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}") {
    throw "Contract contains possible credential or personal data."
  }

  foreach ($status in $ExpectedErrorContract.Keys) {
    $property = $Contract.errorContract.PSObject.Properties[$status]
    if ($null -eq $property) { throw "Missing error contract HTTP $status." }
    Assert-StringSetEqual -Actual @($property.Value | ForEach-Object { [string]$_ }) -Expected $ExpectedErrorContract[$status] -Label "HTTP $status error codes"
  }
  if (@($Contract.errorContract.PSObject.Properties).Count -ne $ExpectedErrorContract.Count) { throw "Unexpected HTTP error contract entries." }
  Assert-StringSetEqual -Actual @($Contract.batchErrorCodes | ForEach-Object { [string]$_ }) -Expected $ExpectedBatchErrorCodes -Label "Batch error codes"

  $environmentByName = @{}
  foreach ($definition in @($Contract.environmentVariables)) {
    $name = [string]$definition.name
    if ([string]::IsNullOrWhiteSpace($name) -or $environmentByName.ContainsKey($name)) { throw "Environment variable names must be unique and non-empty." }
    $environmentByName[$name] = $definition
  }
  foreach ($secretName in @("TONGKAN_QA_TOKEN_A", "TONGKAN_QA_TOKEN_B", "TONGKAN_QA_TOKEN_C", "TONGKAN_QA_TEST_KEY")) {
    if (-not $environmentByName.ContainsKey($secretName) -or -not [bool]$environmentByName[$secretName].secret) {
      throw "$secretName must be declared secret."
    }
  }

  $ids = @{}
  foreach ($case in @($Contract.cases)) {
    $caseId = [string]$case.id
    if ([string]::IsNullOrWhiteSpace($caseId) -or $ids.ContainsKey($caseId)) { throw "Case ids must be unique and non-empty." }
    $ids[$caseId] = $true
    if (@("sequential", "revisionRace") -notcontains [string]$case.mode) { throw "${caseId}: invalid mode." }
    $baselineRequests = @(Get-OptionalValue -Object $case -Name "baselineRequests" -Default @())
    if ([string]$case.mode -eq "revisionRace") {
      if ([int](Get-OptionalValue -Object $case -Name "iterations" -Default 0) -ne 20) { throw "${caseId}: revision race must run exactly 20 iterations." }
      if ($baselineRequests.Count -eq 0 -or @($case.requests).Count -ne 2) { throw "${caseId}: revision race requires a baseline and two contenders." }
    }
    foreach ($name in @(Get-OptionalValue -Object $case -Name "requiredEnvironment" -Default @())) {
      if (-not $environmentByName.ContainsKey([string]$name)) { throw "${caseId}: undeclared environment variable $name." }
      if ([bool]$environmentByName[[string]$name].secret) { throw "${caseId}: secret values cannot be contract fixtures." }
    }
    foreach ($request in $baselineRequests + @($case.requests)) { Assert-RequestDefinition -Request $request -CaseId $caseId }
  }
  [void](Resolve-SelectedCases -Contract $Contract -RequestedIds @($Contract.cases | ForEach-Object { [string]$_.id }))
}

Assert-PreviewOrigin -Origin $ApiOrigin
if (-not (Test-Path -LiteralPath $CasesPath -PathType Leaf)) { throw "Contract file not found." }
$rawContract = Get-Content -LiteralPath $CasesPath -Raw -Encoding UTF8
$contract = $rawContract | ConvertFrom-Json
Assert-ContractShape -Contract $contract -RawContract $rawContract
$selectedCases = @(Resolve-SelectedCases -Contract $contract -RequestedIds $CaseId)

if ($Mode -eq "ValidateOnly") {
  Write-Host "Contract validation passed: $($selectedCases.Count) cases; no secret read and no network request sent."
  exit 0
}

function New-CaseRequest {
  param(
    [pscustomobject]$Definition,
    [hashtable]$State,
    [int]$Iteration,
    [string]$TokenA,
    [string]$TokenB,
    [string]$TokenC,
    [string]$TestKey
  )
  $path = [string](Resolve-TemplateString -Value ([string]$Definition.path) -State $State -Iteration $Iteration)
  $base = $ApiOrigin.AbsoluteUri.TrimEnd("/")
  $targetText = "$base/$($path.TrimStart('/'))"
  $queryDefinition = Get-OptionalValue -Object $Definition -Name "query"
  if ($null -ne $queryDefinition) {
    $parts = @()
    foreach ($property in $queryDefinition.PSObject.Properties) {
      $resolved = Resolve-TemplateValue -Value $property.Value -State $State -Iteration $Iteration
      if ($null -eq $resolved) { continue }
      $parts += "$([Uri]::EscapeDataString($property.Name))=$([Uri]::EscapeDataString([Convert]::ToString($resolved, [System.Globalization.CultureInfo]::InvariantCulture)))"
    }
    if ($parts.Count -gt 0) { $targetText += "?" + ($parts -join "&") }
  }
  $target = [Uri]$targetText
  if ($target.DnsSafeHost.ToLowerInvariant() -ne $ApiOrigin.DnsSafeHost.ToLowerInvariant()) { throw "Resolved request escaped the preview origin." }

  $method = [System.Net.Http.HttpMethod]::new(([string]$Definition.method).ToUpperInvariant())
  $message = [System.Net.Http.HttpRequestMessage]::new($method, $target)
  $actor = ([string]$Definition.actor).ToUpperInvariant()
  $token = if ($actor -eq "A") { $TokenA } elseif ($actor -eq "B") { $TokenB } elseif ($actor -eq "C") { $TokenC } else { $null }
  if (-not [string]::IsNullOrWhiteSpace($token)) {
    $message.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $token)
  }
  if (-not [string]::IsNullOrWhiteSpace($TestKey)) {
    [void]$message.Headers.TryAddWithoutValidation("X-Tongkan-Test-Key", $TestKey)
  }

  $contentType = [string](Get-OptionalValue -Object $Definition -Name "contentType" -Default "application/json")
  if ($Definition.PSObject.Properties.Name -contains "rawBody") {
    $rawBody = [string](Resolve-TemplateString -Value ([string]$Definition.rawBody) -State $State -Iteration $Iteration)
    $message.Content = [System.Net.Http.StringContent]::new($rawBody, [Text.Encoding]::UTF8, $contentType)
  } elseif ($Definition.PSObject.Properties.Name -contains "body") {
    $resolvedBody = Resolve-TemplateValue -Value $Definition.body -State $State -Iteration $Iteration
    $json = ConvertTo-Json $resolvedBody -Compress -Depth 30
    $message.Content = [System.Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, $contentType)
  }
  return $message
}

function Complete-CaseResponse {
  param([pscustomobject]$Definition, [System.Net.Http.HttpResponseMessage]$Response)
  $text = if ($null -ne $Response.Content) { $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } else { "" }
  $body = $null
  if (-not [string]::IsNullOrWhiteSpace($text)) {
    try { $body = $text | ConvertFrom-Json }
    catch { $body = $null }
  }
  $errorInfo = Get-BodyPathInfo -Body $body -Path "error"
  return [pscustomobject]@{
    Name = [string]$Definition.name
    Status = [int]$Response.StatusCode
    ErrorCode = if ($errorInfo.Exists) { [string]$errorInfo.Value } else { $null }
    Body = $body
  }
}

function Assert-CountMap {
  param([object[]]$Values, [pscustomobject]$Expected, [string]$Label)
  $actual = @{}
  foreach ($value in @($Values)) {
    if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) { continue }
    $key = [string]$value
    $actual[$key] = if ($actual.ContainsKey($key)) { [int]$actual[$key] + 1 } else { 1 }
  }
  $expectedTotal = 0
  foreach ($property in $Expected.PSObject.Properties) {
    $expectedCount = [int]$property.Value
    $expectedTotal += $expectedCount
    $actualCount = if ($actual.ContainsKey($property.Name)) { [int]$actual[$property.Name] } else { 0 }
    if ($actualCount -ne $expectedCount) { throw "$Label count mismatch for $($property.Name)." }
  }
  $actualTotal = 0
  foreach ($count in $actual.Values) { $actualTotal += [int]$count }
  if ($actualTotal -ne $expectedTotal) { throw "$Label contains unexpected values." }
}

function Assert-ArrayContains {
  param($Body, [object[]]$Definitions, [hashtable]$State, [int]$Iteration)
  foreach ($definition in @($Definitions)) {
    $arrayInfo = Get-BodyPathInfo -Body $Body -Path ([string]$definition.path)
    if (-not $arrayInfo.Exists -or $arrayInfo.Value -isnot [System.Collections.IEnumerable] -or $arrayInfo.Value -is [string]) {
      throw "Expected array missing at $($definition.path)."
    }
    $found = $false
    foreach ($item in @($arrayInfo.Value)) {
      $matches = $true
      foreach ($property in $definition.match.PSObject.Properties) {
        $actualInfo = Get-BodyPathInfo -Body $item -Path $property.Name
        $expected = Resolve-TemplateValue -Value $property.Value -State $State -Iteration $Iteration
        if (-not $actualInfo.Exists -or -not (Test-EqualValue -Actual $actualInfo.Value -Expected $expected)) { $matches = $false; break }
      }
      if ($matches) { $found = $true; break }
    }
    if (-not $found) { throw "Expected array member missing at $($definition.path)." }
  }
}

function Assert-RequestResult {
  param([pscustomobject]$Definition, [pscustomobject]$Result, [hashtable]$State, [int]$Iteration)
  $expectation = Get-OptionalValue -Object $Definition -Name "expect"
  if ($null -eq $expectation) { return }
  if (@($expectation.statuses) -notcontains $Result.Status) { throw "$($Definition.name): unexpected HTTP status $($Result.Status) error $($Result.ErrorCode)." }
  $expectedError = Get-OptionalValue -Object $expectation -Name "errorCode"
  if ($null -ne $expectedError -and [string]$expectedError -cne [string]$Result.ErrorCode) { throw "$($Definition.name): unexpected error code." }

  $bodyExpectations = Get-OptionalValue -Object $expectation -Name "body"
  if ($null -ne $bodyExpectations) {
    foreach ($property in $bodyExpectations.PSObject.Properties) {
      $actual = Get-BodyPathInfo -Body $Result.Body -Path $property.Name
      $expected = Resolve-TemplateValue -Value $property.Value -State $State -Iteration $Iteration
      if (-not $actual.Exists -or -not (Test-EqualValue -Actual $actual.Value -Expected $expected)) { throw "$($Definition.name): body mismatch at $($property.Name)." }
    }
  }
  $bodyNot = Get-OptionalValue -Object $expectation -Name "bodyNot"
  if ($null -ne $bodyNot) {
    foreach ($property in $bodyNot.PSObject.Properties) {
      $actual = Get-BodyPathInfo -Body $Result.Body -Path $property.Name
      $unexpected = Resolve-TemplateValue -Value $property.Value -State $State -Iteration $Iteration
      if ($actual.Exists -and (Test-EqualValue -Actual $actual.Value -Expected $unexpected)) { throw "$($Definition.name): forbidden body value at $($property.Name)." }
    }
  }
  foreach ($path in @(Get-OptionalValue -Object $expectation -Name "bodyAbsent" -Default @())) {
    if ((Get-BodyPathInfo -Body $Result.Body -Path ([string]$path)).Exists) { throw "$($Definition.name): body path must be absent: $path." }
  }
  $arrayCounts = Get-OptionalValue -Object $expectation -Name "arrayCount"
  if ($null -ne $arrayCounts) {
    foreach ($property in $arrayCounts.PSObject.Properties) {
      $info = Get-BodyPathInfo -Body $Result.Body -Path $property.Name
      if (-not $info.Exists -or @($info.Value).Count -ne [int]$property.Value) { throw "$($Definition.name): array count mismatch at $($property.Name)." }
    }
  }
  $arrayContains = Get-OptionalValue -Object $expectation -Name "arrayContains"
  if ($null -ne $arrayContains) { Assert-ArrayContains -Body $Result.Body -Definitions @($arrayContains) -State $State -Iteration $Iteration }

  foreach ($arrayOrderDefinition in @(Get-OptionalValue -Object $expectation -Name "arrayOrder" -Default @())) {
    $arrayInfo = Get-BodyPathInfo -Body $Result.Body -Path ([string]$arrayOrderDefinition.path)
    if (-not $arrayInfo.Exists) { throw "$($Definition.name): ordered array missing." }
    $actual = @($arrayInfo.Value | ForEach-Object { (Get-BodyPathInfo -Body $_ -Path ([string]$arrayOrderDefinition.property)).Value })
    $expected = @(Resolve-TemplateValue -Value $arrayOrderDefinition.expected -State $State -Iteration $Iteration)
    if ($expected.Count -eq 1 -and $expected[0] -is [System.Array]) { $expected = @($expected[0]) }
    if (-not (Test-EqualValue -Actual $actual -Expected $expected)) { throw "$($Definition.name): array order mismatch at $($arrayOrderDefinition.path)." }
  }
  foreach ($uniqueDefinition in @(Get-OptionalValue -Object $expectation -Name "uniqueBy" -Default @())) {
    $arrayInfo = Get-BodyPathInfo -Body $Result.Body -Path ([string]$uniqueDefinition.path)
    if (-not $arrayInfo.Exists) { throw "$($Definition.name): unique array missing." }
    $seen = @{}
    foreach ($item in @($arrayInfo.Value)) {
      $valueInfo = Get-BodyPathInfo -Body $item -Path ([string]$uniqueDefinition.property)
      if (-not $valueInfo.Exists) { throw "$($Definition.name): unique property missing." }
      $key = ConvertTo-Json $valueInfo.Value -Compress -Depth 10
      if ($seen.ContainsKey($key)) { throw "$($Definition.name): duplicate value in $($uniqueDefinition.path)." }
      $seen[$key] = $true
    }
  }
  $batchStatuses = Get-OptionalValue -Object $expectation -Name "batchStatusCounts"
  if ($null -ne $batchStatuses) {
    $resultsInfo = Get-BodyPathInfo -Body $Result.Body -Path "results"
    if (-not $resultsInfo.Exists) { throw "$($Definition.name): batch results missing." }
    Assert-CountMap -Values @($resultsInfo.Value | ForEach-Object { $_.status }) -Expected $batchStatuses -Label "$($Definition.name) batch status"
  }
  $batchErrors = Get-OptionalValue -Object $expectation -Name "batchErrorCounts"
  if ($null -ne $batchErrors) {
    $resultsInfo = Get-BodyPathInfo -Body $Result.Body -Path "results"
    if (-not $resultsInfo.Exists) { throw "$($Definition.name): batch results missing." }
    Assert-CountMap -Values @($resultsInfo.Value | ForEach-Object { $info = Get-BodyPathInfo -Body $_ -Path "error"; if ($info.Exists) { $info.Value } }) -Expected $batchErrors -Label "$($Definition.name) batch error"
  }
  $revisionDelta = Get-OptionalValue -Object $expectation -Name "revisionDelta"
  if ($null -ne $revisionDelta) {
    $actual = Get-BodyPathInfo -Body $Result.Body -Path ([string]$revisionDelta.path)
    $fromName = [string]$revisionDelta.from
    if (-not $State.ContainsKey($fromName)) { throw "$($Definition.name): revision baseline missing." }
    $expected = [long]$State[$fromName] + [long]$revisionDelta.delta
    if (-not $actual.Exists -or [long]$actual.Value -ne $expected) { throw "$($Definition.name): revision delta mismatch." }
  }
}

function Save-Captures {
  param([pscustomobject]$Definition, [pscustomobject]$Result, [hashtable]$State)
  $captures = Get-OptionalValue -Object $Definition -Name "capture"
  if ($null -eq $captures) { return }
  foreach ($property in $captures.PSObject.Properties) {
    $info = Get-BodyPathInfo -Body $Result.Body -Path ([string]$property.Value)
    if (-not $info.Exists) { throw "$($Definition.name): capture path missing for $($property.Name)." }
    $State[$property.Name] = $info.Value
  }
}

function Assert-AggregateResult {
  param([pscustomobject]$Expectation, [object[]]$Results)
  $statusCounts = Get-OptionalValue -Object $Expectation -Name "statusCounts"
  if ($null -ne $statusCounts) { Assert-CountMap -Values @($Results | ForEach-Object { [string]$_.Status }) -Expected $statusCounts -Label "aggregate HTTP status" }
  $errorCounts = Get-OptionalValue -Object $Expectation -Name "errorCodeCounts"
  if ($null -ne $errorCounts) { Assert-CountMap -Values @($Results | ForEach-Object { $_.ErrorCode }) -Expected $errorCounts -Label "aggregate error code" }
  if ([bool](Get-OptionalValue -Object $Expectation -Name "conflictRevisionMatchesSuccessRevision" -Default $false)) {
    $successes = @($Results | Where-Object { $_.Status -eq 200 })
    $conflicts = @($Results | Where-Object { $_.Status -eq 409 -and $_.ErrorCode -eq "LIBRARY_VERSION_CONFLICT" })
    if ($successes.Count -ne 1 -or $conflicts.Count -ne 1) { throw "Revision race must have one success and one version conflict." }
    $successRevision = Get-BodyPathInfo -Body $successes[0].Body -Path "revision"
    $conflictRevision = Get-BodyPathInfo -Body $conflicts[0].Body -Path "currentRevision"
    if (-not $successRevision.Exists -or -not $conflictRevision.Exists -or [long]$successRevision.Value -ne [long]$conflictRevision.Value) {
      throw "Conflict currentRevision does not match the successful revision."
    }
  }
}

function Invoke-OneRequest {
  param(
    [System.Net.Http.HttpClient]$Client,
    [pscustomobject]$Definition,
    [hashtable]$State,
    [int]$Iteration,
    [string]$TokenA,
    [string]$TokenB,
    [string]$TokenC,
    [string]$TestKey
  )
  $message = New-CaseRequest -Definition $Definition -State $State -Iteration $Iteration -TokenA $TokenA -TokenB $TokenB -TokenC $TokenC -TestKey $TestKey
  try {
    $response = $Client.SendAsync($message).GetAwaiter().GetResult()
    try { $result = Complete-CaseResponse -Definition $Definition -Response $response }
    finally { $response.Dispose() }
  } finally { $message.Dispose() }
  Assert-RequestResult -Definition $Definition -Result $result -State $State -Iteration $Iteration
  Save-Captures -Definition $Definition -Result $result -State $State
  return $result
}

function Invoke-ParallelRequests {
  param(
    [System.Net.Http.HttpClient]$Client,
    [object[]]$Definitions,
    [hashtable]$State,
    [int]$Iteration,
    [string]$TokenA,
    [string]$TokenB,
    [string]$TokenC,
    [string]$TestKey
  )
  $pending = @()
  foreach ($definition in @($Definitions)) {
    $message = New-CaseRequest -Definition $definition -State $State -Iteration $Iteration -TokenA $TokenA -TokenB $TokenB -TokenC $TokenC -TestKey $TestKey
    $pending += [pscustomobject]@{ Definition = $definition; Message = $message; Task = $Client.SendAsync($message) }
  }
  $results = @()
  foreach ($item in $pending) {
    $response = $item.Task.GetAwaiter().GetResult()
    try { $result = Complete-CaseResponse -Definition $item.Definition -Response $response }
    finally { $response.Dispose(); $item.Message.Dispose() }
    Assert-RequestResult -Definition $item.Definition -Result $result -State $State -Iteration $Iteration
    Save-Captures -Definition $item.Definition -Result $result -State $State
    $results += $result
  }
  return @($results)
}

$actors = @()
foreach ($case in $selectedCases) {
  $definitions = @(Get-OptionalValue -Object $case -Name "baselineRequests" -Default @()) + @($case.requests)
  $actors += @($definitions | ForEach-Object { [string]$_.actor })
}
$actors = @($actors | Select-Object -Unique)
$tokenA = if ($actors -contains "A") { Get-SecretValue -Name "TONGKAN_QA_TOKEN_A" -Prompt "Token A" -Required $true } else { $null }
$tokenB = if ($actors -contains "B") { Get-SecretValue -Name "TONGKAN_QA_TOKEN_B" -Prompt "Token B" -Required $true } else { $null }
$tokenC = if ($actors -contains "C") { Get-SecretValue -Name "TONGKAN_QA_TOKEN_C" -Prompt "Token C" -Required $true } else { $null }
$testKey = if (-not (Test-IsLocalOrigin -Origin $ApiOrigin)) { Get-SecretValue -Name "TONGKAN_QA_TEST_KEY" -Prompt "Preview test key" -Required $true } else { $null }

$handler = [System.Net.Http.HttpClientHandler]::new()
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
$state = @{}
$currentCaseId = "initialization"
$failed = $false
try {
  foreach ($case in $selectedCases) {
    $currentCaseId = [string]$case.id
    foreach ($name in @(Get-OptionalValue -Object $case -Name "requiredEnvironment" -Default @())) {
      if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable([string]$name, "Process"))) {
        throw "$currentCaseId requires non-secret process environment variable $name."
      }
    }

    if ([string]$case.mode -eq "revisionRace") {
      for ($iteration = 1; $iteration -le [int]$case.iterations; $iteration++) {
        foreach ($definition in @($case.baselineRequests)) {
          $result = Invoke-OneRequest -Client $client -Definition $definition -State $state -Iteration $iteration -TokenA $tokenA -TokenB $tokenB -TokenC $tokenC -TestKey $testKey
          Write-Host "PASS $currentCaseId/$($result.Name) iteration $iteration HTTP $($result.Status)"
        }
        $results = @(Invoke-ParallelRequests -Client $client -Definitions @($case.requests) -State $state -Iteration $iteration -TokenA $tokenA -TokenB $tokenB -TokenC $tokenC -TestKey $testKey)
        Assert-AggregateResult -Expectation $case.aggregateExpect -Results $results
        Write-Host "PASS $currentCaseId iteration $iteration aggregate"
      }
      continue
    }

    foreach ($definition in @($case.requests)) {
      $result = Invoke-OneRequest -Client $client -Definition $definition -State $state -Iteration 0 -TokenA $tokenA -TokenB $tokenB -TokenC $tokenC -TestKey $testKey
      $errorSuffix = if ([string]::IsNullOrWhiteSpace([string]$result.ErrorCode)) { "" } else { " $($result.ErrorCode)" }
      Write-Host "PASS $currentCaseId/$($result.Name) HTTP $($result.Status)$errorSuffix"
    }
  }
} catch {
  $failed = $true
  Write-Error "Case $currentCaseId failed ($($_.Exception.GetType().Name)); request, response and fixture values omitted."
} finally {
  $client.Dispose()
  $handler.Dispose()
  $tokenA = $null
  $tokenB = $null
  $tokenC = $null
  $testKey = $null
  $state.Clear()
}

if ($failed) { exit 1 }
Write-Host "Preview contract passed: $($selectedCases.Count) cases."
