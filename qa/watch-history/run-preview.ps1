[CmdletBinding()]
param(
  [Uri]$ApiOrigin = "https://tongkan-account-preview-gateway.pages.dev/account-api",
  [string]$CasesPath = "",
  [switch]$ValidateOnly,
  [switch]$Live,
  [string[]]$CaseId = @(),
  [SecureString]$TokenA,
  [SecureString]$TokenB,
  [SecureString]$TokenC,
  [SecureString]$PreviewTestKey,
  [ValidateRange(1, 120)]
  [int]$TimeoutSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ($ValidateOnly -and $Live) { throw "Choose either -ValidateOnly or -Live, not both." }
$AllowedPreviewHosts = @("tongkan-account-preview-gateway.pages.dev")
$RequiredCoverage = @(
  "a-b-c", "anonymous", "grant-lifecycle", "report-cadence", "overlap-matrix",
  "retry-idempotency", "history-pagination", "monthly-offset", "calendar-markers",
  "archive-keep", "archive-forbidden", "cascade", "sensitive-output"
)

if ([string]::IsNullOrWhiteSpace($CasesPath)) { $CasesPath = Join-Path $PSScriptRoot "contract-cases.json" }

function Test-IsLocalOrigin([Uri]$Origin) {
  return @("localhost", "127.0.0.1") -contains $Origin.DnsSafeHost.ToLowerInvariant()
}

function Assert-PreviewOrigin([Uri]$Origin) {
  if (-not $Origin.IsAbsoluteUri) { throw "ApiOrigin must be absolute." }
  $hostName = $Origin.DnsSafeHost.ToLowerInvariant()
  if ($hostName -eq "tongkan-personal.pages.dev") { throw "Production origin is forbidden." }
  if (Test-IsLocalOrigin $Origin) {
    if (@("http", "https") -notcontains $Origin.Scheme) { throw "Local origin must use HTTP or HTTPS." }
    return
  }
  if ($Origin.Scheme -ne "https" -or $AllowedPreviewHosts -notcontains $hostName) {
    throw "Remote origin is not in the exact Preview allowlist."
  }
}

function Convert-SecureValue([SecureString]$Value, [string]$Name, [bool]$Required) {
  if ($null -eq $Value) {
    if ($Required) { throw "Missing secure input $Name." }
    return $null
  }
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($Required -and [string]::IsNullOrWhiteSpace($plain)) { throw "Missing secure input $Name." }
    return $plain
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Resolve-TemplateString([string]$Value) {
  return [regex]::Replace($Value, "\{\{([A-Z0-9_]+)\}\}", {
    param($match)
    $name = $match.Groups[1].Value
    if ($name -match "TOKEN|SECRET|TEST_KEY|SIGNATURE|GRANT") { throw "Secret placeholder $name is forbidden." }
    $resolved = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrWhiteSpace($resolved)) { throw "Missing case environment variable $name." }
    return $resolved
  })
}

function Resolve-TemplateValue($Value) {
  if ($null -eq $Value) { return $null }
  if ($Value -is [string]) { return Resolve-TemplateString $Value }
  if ($Value -is [pscustomobject]) {
    $result = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) { $result[$property.Name] = Resolve-TemplateValue $property.Value }
    return [pscustomobject]$result
  }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
    return @($Value | ForEach-Object { Resolve-TemplateValue $_ })
  }
  return $Value
}

function Get-PathValue($Body, [string]$Path) {
  $current = $Body
  foreach ($segment in $Path.Split(".")) {
    if ($null -eq $current) { return $null }
    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) { return $null }
    $current = $property.Value
  }
  return $current
}

function Test-PathExists($Body, [string]$Path) {
  $current = $Body
  foreach ($segment in $Path.Split(".")) {
    if ($null -eq $current) { return $false }
    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) { return $false }
    $current = $property.Value
  }
  return $true
}

Assert-PreviewOrigin $ApiOrigin
if (-not (Test-Path -LiteralPath $CasesPath -PathType Leaf)) { throw "Cases file not found: $CasesPath" }
$raw = Get-Content -Raw -Encoding UTF8 -LiteralPath $CasesPath
if ($raw -match "tongkan-personal\.pages\.dev|Authorization\s*:|Bearer\s+|X-Tongkan-History-Signature|sessionToken|roomKey|inviteUrl") {
  throw "Cases file contains a production URL or sensitive output field."
}
$contract = $raw | ConvertFrom-Json
if ($contract.schemaVersion -ne 1 -or $contract.previewOnly -ne $true) { throw "Unsupported or unsafe contract schema." }
if ($contract.cases.Count -lt 1) { throw "Contract must contain cases." }

$ids = @{}
$coverage = @{}
$allowedKinds = @("http", "android-jvm", "signaling-contract", "integration-contract", "security-scan")
$allowedActors = @("A", "B", "C", "none")
foreach ($case in $contract.cases) {
  if ([string]::IsNullOrWhiteSpace([string]$case.id) -or $ids.ContainsKey([string]$case.id)) { throw "Case IDs must be non-empty and unique." }
  $ids[[string]$case.id] = $true
  if ($allowedKinds -notcontains [string]$case.kind) { throw "Unsupported case kind: $($case.kind)" }
  if ($case.kind -eq "http" -and $allowedActors -notcontains [string]$case.actor) { throw "Unsupported HTTP actor: $($case.actor)" }
  foreach ($item in $case.coverage) { $coverage[[string]$item] = $true }
}
foreach ($item in $RequiredCoverage) { if (-not $coverage.ContainsKey($item)) { throw "Missing required coverage: $item" } }

$selected = @($contract.cases | Where-Object { $CaseId.Count -eq 0 -or $CaseId -contains [string]$_.id })
if ($CaseId.Count -gt 0 -and $selected.Count -ne $CaseId.Count) { throw "One or more requested CaseId values do not exist." }
if (-not $Live) {
  Write-Output ("watch-history ValidateOnly PASS: {0} cases, {1} coverage tags, preview-only." -f $selected.Count, $coverage.Count)
  exit 0
}

$tokenValues = @{
  A = Convert-SecureValue $TokenA "TokenA" $true
  B = Convert-SecureValue $TokenB "TokenB" $true
  C = Convert-SecureValue $TokenC "TokenC" $false
}
$testKey = Convert-SecureValue $PreviewTestKey "PreviewTestKey" $false
$executed = 0
foreach ($case in $selected) {
  if ($case.kind -ne "http") { continue }
  $path = Resolve-TemplateString ([string]$case.request.path)
  $target = [Uri]($ApiOrigin.AbsoluteUri.TrimEnd("/") + "/" + $path.TrimStart("/"))
  Assert-PreviewOrigin ([Uri]("{0}://{1}" -f $target.Scheme, $target.Authority))
  $headers = @{ Accept = "application/json" }
  $actor = [string]$case.actor
  if ($actor -ne "none") {
    $token = $tokenValues[$actor]
    if ([string]::IsNullOrWhiteSpace($token)) { throw "Missing secure token for actor $actor." }
    $headers.Authorization = "Bearer $token"
  }
  if (-not [string]::IsNullOrWhiteSpace($testKey)) { $headers["X-Tongkan-Test-Key"] = $testKey }
  $parameters = @{
    Uri = $target
    Method = ([string]$case.request.method).ToUpperInvariant()
    Headers = $headers
    TimeoutSec = $TimeoutSeconds
  }
  $invokeWebRequestParameters = (Get-Command Invoke-WebRequest).Parameters
  if ($invokeWebRequestParameters.ContainsKey("UseBasicParsing")) { $parameters.UseBasicParsing = $true }
  if ($invokeWebRequestParameters.ContainsKey("SkipHttpErrorCheck")) { $parameters.SkipHttpErrorCheck = $true }
  if ($null -ne $case.request.PSObject.Properties["body"]) {
    $parameters.ContentType = "application/json"
    $parameters.Body = (Resolve-TemplateValue $case.request.body | ConvertTo-Json -Compress -Depth 30)
  }
  try {
    $response = Invoke-WebRequest @parameters
  } catch {
    $errorResponse = $_.Exception.Response
    if ($null -eq $errorResponse) { throw }
    $reader = New-Object IO.StreamReader($errorResponse.GetResponseStream())
    try {
      $response = [pscustomobject]@{
        StatusCode = [int]$errorResponse.StatusCode
        Content = $reader.ReadToEnd()
      }
    } finally {
      $reader.Dispose()
    }
  }
  $expectedStatuses = @($case.expect.statuses | ForEach-Object { [int]$_ })
  if ($expectedStatuses -notcontains [int]$response.StatusCode) { throw "Case $($case.id) returned unexpected HTTP $($response.StatusCode)." }
  $body = if ([string]::IsNullOrWhiteSpace($response.Content)) { $null } else { $response.Content | ConvertFrom-Json }
  $requiredProperty = $case.expect.PSObject.Properties["required"]
  if ($null -ne $requiredProperty) {
    foreach ($pathName in @($requiredProperty.Value)) {
      if (-not (Test-PathExists $body ([string]$pathName)) -or $null -eq (Get-PathValue $body ([string]$pathName))) {
        throw "Case $($case.id) is missing $pathName."
      }
    }
  }
  $presentProperty = $case.expect.PSObject.Properties["present"]
  if ($null -ne $presentProperty) {
    foreach ($pathName in @($presentProperty.Value)) {
      if (-not (Test-PathExists $body ([string]$pathName))) { throw "Case $($case.id) is missing $pathName." }
    }
  }
  $valuesProperty = $case.expect.PSObject.Properties["values"]
  if ($null -ne $valuesProperty) {
    foreach ($property in $valuesProperty.Value.PSObject.Properties) {
      if (-not (Test-PathExists $body $property.Name)) { throw "Case $($case.id) is missing $($property.Name)." }
      $actual = Get-PathValue $body $property.Name
      if ((ConvertTo-Json $actual -Compress) -cne (ConvertTo-Json $property.Value -Compress)) { throw "Case $($case.id) value mismatch at $($property.Name)." }
    }
  }
  $errorsProperty = $case.expect.PSObject.Properties["errors"]
  if ($null -ne $errorsProperty) {
    $actualError = [string](Get-PathValue $body "error")
    if (@($errorsProperty.Value) -notcontains $actualError) { throw "Case $($case.id) returned unexpected error code." }
  }
  $executed += 1
  Write-Output ("PASS {0} HTTP {1}" -f $case.id, [int]$response.StatusCode)
}
Write-Output ("watch-history Live PASS: {0} HTTP cases executed; non-HTTP contracts remain reviewer-integrated." -f $executed)
