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
  [string]$LibraryItem1 = "",
  [string]$LibraryItem2 = "",
  [string]$LibraryItem3 = "",
  [string]$ForeignLibraryItemId = "",
  [string]$CrudDate = "",
  [string]$CrudUpdatedDate = "",
  [string]$SortDate = "",
  [string]$DuplicateDate = "",
  [string]$RaceStartDate = "",
  [string]$KeepPairId = "",
  [string]$KeepMonth = "",
  [string]$KeepPlanId = "",
  [string]$PendingPairId = "",
  [string]$DeletePairId = "",
  [string]$DeletedPairId = "",
  [string]$RunId = "",
  [ValidateRange(1, 120)]
  [int]$TimeoutSeconds = 20
)

Set-StrictMode -Version Latest
if ($ValidateOnly -and $Live) { throw "Choose either -ValidateOnly or -Live, not both." }
$runLive = [bool]$Live
$ErrorActionPreference = "Stop"

$AllowedRemotePreviewHosts = @("tongkan-account-preview-gateway.pages.dev")
$ExpectedErrorContract = [ordered]@{
  "400" = @("INVALID_REQUEST", "INVALID_JSON")
  "401" = @("AUTH_REQUIRED")
  "403" = @("ARCHIVE_FORBIDDEN")
  "404" = @("NOT_FOUND", "LIBRARY_ITEM_NOT_FOUND", "PLAN_NOT_FOUND")
  "409" = @("PAIR_REQUIRED", "PLAN_ALREADY_EXISTS", "CALENDAR_VERSION_CONFLICT")
  "415" = @("JSON_REQUIRED")
}
$ExpectedCoverage = @("auth", "no-pair", "a-b-consistency", "query-boundaries", "mutation-validation", "crud", "sorting", "today-filter", "duplicate", "stale-revision", "revision-race-20", "late-write", "archive-keep", "archive-forbidden", "cascade")

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

function Convert-SecureText {
  param([SecureString]$Value, [string]$Label, [bool]$Required)
  if ($null -eq $Value) {
    if ($Required) { throw "Missing secure input $Label." }
    return $null
  }
  $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($Required -and [string]::IsNullOrWhiteSpace($plain)) { throw "Missing secure input $Label." }
    return $plain
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
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
  if ($Name -match "TOKEN|TEST_KEY|AUTHORIZATION") { throw "Contract placeholders must not reference secrets." }
  if ($Name -eq "ITERATION") { return $Iteration }
  if ($Name -eq "ITERATION_2") { return ($Iteration + 1) }
  if ($Name -eq "NOTE_200") { return ("x" * 200) }
  if ($Name -eq "NOTE_201") { return ("x" * 201) }
  if ($Name -eq "RACE_DATE") {
    $start = [DateTime]::ParseExact([string]$State["RACE_START_DATE"], "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
    return $start.AddDays($Iteration - 1).ToString("yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  }
  if ($Name -in @("CRUD_MONTH", "SORT_MONTH")) {
    $sourceName = if ($Name -eq "CRUD_MONTH") { "CRUD_DATE" } else { "SORT_DATE" }
    return ([string]$State[$sourceName]).Substring(0, 7)
  }
  if ($Name -in @("CRUD_MONTH_FROM", "CRUD_MONTH_TO")) {
    $month = ([string]$State["CRUD_DATE"]).Substring(0, 7)
    if ($Name.EndsWith("FROM")) { return "$month-01" }
    $parsed = [DateTime]::ParseExact("$month-01", "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
    return $parsed.AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  }
  if ($Name -match "^(.+)_PLUS_([0-9]+)$") {
    $baseName = [string]$Matches[1]
    if (-not $State.ContainsKey($baseName)) { throw "Missing template value $baseName." }
    return ([long]$State[$baseName] + [long]$Matches[2])
  }
  if ($State.ContainsKey($Name)) { return $State[$Name] }
  throw "Missing template value $Name."
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
  if ([string]$Contract.feature -ne "TK-004-calendar") { throw "Unexpected contract feature." }
  if ($RawContract -match "(?i)BEGIN PRIVATE KEY|bearer\s+[A-Za-z0-9._-]+|authorization\s*[:=]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}") { throw "Contract contains possible credential or personal data." }
  foreach ($status in $ExpectedErrorContract.Keys) {
    $property = $Contract.errorContract.PSObject.Properties[$status]
    if ($null -eq $property) { throw "Missing error contract HTTP $status." }
    Assert-StringSetEqual -Actual @($property.Value | ForEach-Object { [string]$_ }) -Expected $ExpectedErrorContract[$status] -Label "HTTP $status error codes"
  }
  if (@($Contract.errorContract.PSObject.Properties).Count -ne $ExpectedErrorContract.Count) { throw "Unexpected HTTP error contract entries." }
  $liveInputs = @{}
  foreach ($definition in @($Contract.liveInputs)) {
    $name = [string]$definition.name
    if ([string]::IsNullOrWhiteSpace($name) -or $liveInputs.ContainsKey($name)) { throw "Live input names must be unique and non-empty." }
    if (@("hexId", "date", "month", "runId") -notcontains [string]$definition.kind) { throw "Unsupported live input kind for $name." }
    $liveInputs[$name] = $definition
  }
  $ids = @{}
  $coverage = @{}
  foreach ($case in @($Contract.cases)) {
    $caseId = [string]$case.id
    if ([string]::IsNullOrWhiteSpace($caseId) -or $ids.ContainsKey($caseId)) { throw "Case ids must be unique and non-empty." }
    $ids[$caseId] = $true
    foreach ($tag in @($case.coverage)) { $coverage[[string]$tag] = $true }
    if (@("sequential", "revisionRace") -notcontains [string]$case.mode) { throw "${caseId}: invalid mode." }
    $baselineRequests = @(Get-OptionalValue -Object $case -Name "baselineRequests" -Default @())
    $verifyRequests = @(Get-OptionalValue -Object $case -Name "verifyRequests" -Default @())
    if ([string]$case.mode -eq "revisionRace") {
      if ([int](Get-OptionalValue -Object $case -Name "iterations" -Default 0) -ne 20) { throw "${caseId}: revision race must run exactly 20 iterations." }
      if ($baselineRequests.Count -eq 0 -or @($case.requests).Count -ne 2 -or $verifyRequests.Count -eq 0) { throw "${caseId}: revision race requires baseline, two contenders and verification." }
    }
    foreach ($request in $baselineRequests + @($case.requests) + $verifyRequests) { Assert-RequestDefinition -Request $request -CaseId $caseId }
  }
  Assert-StringSetEqual -Actual @($coverage.Keys) -Expected $ExpectedCoverage -Label "Required coverage"
  [void](Resolve-SelectedCases -Contract $Contract -RequestedIds @($Contract.cases | ForEach-Object { [string]$_.id }))
  $tables = @{}
  foreach ($definition in @($Contract.d1Evidence)) {
    $sql = ([string]$definition.sql).Trim()
    if ($sql -notmatch "(?is)^SELECT\s+COUNT\(\*\)\s+AS\s+row_count\s+FROM\s+(pairs|pair_calendar_state|calendar_plans)\s+WHERE\s+(id|pair_id)\s*=\s*\?1;?$") { throw "D1 evidence must be a parameterized COUNT query." }
    $tables[[string]$Matches[1]] = $true
  }
  Assert-StringSetEqual -Actual @($tables.Keys) -Expected @("pairs", "pair_calendar_state", "calendar_plans") -Label "D1 cascade tables"
}

function Assert-LiveInputs {
  param([hashtable]$State)
  $idNames = @("LIBRARY_ITEM_1", "LIBRARY_ITEM_2", "LIBRARY_ITEM_3", "FOREIGN_LIBRARY_ITEM_ID", "KEEP_PAIR_ID", "KEEP_PLAN_ID", "PENDING_PAIR_ID", "DELETE_PAIR_ID", "DELETED_PAIR_ID")
  foreach ($name in $idNames) { if ([string]$State[$name] -notmatch "^[a-f0-9]{32}$") { throw "$name must be a 32-character lowercase hex id." } }
  $dateNames = @("CRUD_DATE", "CRUD_UPDATED_DATE", "SORT_DATE", "DUPLICATE_DATE", "RACE_START_DATE")
  $dates = @{}
  foreach ($name in $dateNames) {
    $value = [string]$State[$name]
    $parsed = [DateTime]::MinValue
    if (-not [DateTime]::TryParseExact($value, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsed) -or $parsed.ToString("yyyy-MM-dd") -ne $value) { throw "$name must be a real yyyy-MM-dd date." }
    if ($dates.ContainsKey($value)) { throw "Activity dates must be distinct." }
    $dates[$value] = $true
  }
  $raceStart = [DateTime]::ParseExact([string]$State["RACE_START_DATE"], "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
  for ($offset = 0; $offset -lt 20; $offset += 1) {
    $value = $raceStart.AddDays($offset).ToString("yyyy-MM-dd")
    if ($offset -gt 0 -and $dates.ContainsKey($value)) { throw "Race dates overlap another fixture date." }
  }
  $monthDate = [DateTime]::MinValue
  if (-not [DateTime]::TryParseExact("$($State["KEEP_MONTH"])-01", "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$monthDate)) { throw "KEEP_MONTH must be yyyy-MM." }
  if ([string]$State["RUN_ID"] -notmatch "^[A-Za-z0-9_-]{1,32}$") { throw "RUN_ID must contain only letters, numbers, dash or underscore." }
  $distinctItems = @([string]$State["LIBRARY_ITEM_1"], [string]$State["LIBRARY_ITEM_2"], [string]$State["LIBRARY_ITEM_3"]) | Select-Object -Unique
  if (@($distinctItems).Count -ne 3) { throw "The three library item ids must be distinct." }
}

if (-not (Test-Path -LiteralPath $CasesPath -PathType Leaf)) { throw "Contract file not found." }
$rawContract = Get-Content -LiteralPath $CasesPath -Raw -Encoding UTF8
$contract = $rawContract | ConvertFrom-Json
Assert-ContractShape -Contract $contract -RawContract $rawContract
$selectedCases = @(Resolve-SelectedCases -Contract $contract -RequestedIds $CaseId)
if (-not $runLive) {
  Write-Host "Calendar contract validation passed: $($selectedCases.Count) cases; no secret read, HTTP client or network request used."
  exit 0
}
Assert-PreviewOrigin -Origin $ApiOrigin
Add-Type -AssemblyName System.Net.Http
$fixtureState = @{
  LIBRARY_ITEM_1 = $LibraryItem1; LIBRARY_ITEM_2 = $LibraryItem2; LIBRARY_ITEM_3 = $LibraryItem3; FOREIGN_LIBRARY_ITEM_ID = $ForeignLibraryItemId;
  CRUD_DATE = $CrudDate; CRUD_UPDATED_DATE = $CrudUpdatedDate; SORT_DATE = $SortDate; DUPLICATE_DATE = $DuplicateDate; RACE_START_DATE = $RaceStartDate;
  KEEP_PAIR_ID = $KeepPairId; KEEP_MONTH = $KeepMonth; KEEP_PLAN_ID = $KeepPlanId; PENDING_PAIR_ID = $PendingPairId; DELETE_PAIR_ID = $DeletePairId; DELETED_PAIR_ID = $DeletedPairId; RUN_ID = $RunId
}
Assert-LiveInputs -State $fixtureState

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
  if ($target.DnsSafeHost.ToLowerInvariant() -ne $ApiOrigin.DnsSafeHost.ToLowerInvariant() -or $target.Scheme -ne $ApiOrigin.Scheme -or $target.Port -ne $ApiOrigin.Port) { throw "Resolved request escaped the preview origin." }

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
  foreach ($path in @(Get-OptionalValue -Object $expectation -Name "bodyNonNull" -Default @())) {
    $info = Get-BodyPathInfo -Body $Result.Body -Path ([string]$path)
    if (-not $info.Exists -or $null -eq $info.Value -or ([string]$info.Value).Length -eq 0) { throw "$($Definition.name): body path must be non-null: $path." }
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
  foreach ($definition in @(Get-OptionalValue -Object $expectation -Name "arrayNotContains" -Default @())) {
    $arrayInfo = Get-BodyPathInfo -Body $Result.Body -Path ([string]$definition.path)
    if (-not $arrayInfo.Exists) { throw "$($Definition.name): expected array missing at $($definition.path)." }
    foreach ($item in @($arrayInfo.Value)) {
      $matches = $true
      foreach ($property in $definition.match.PSObject.Properties) {
        $actualInfo = Get-BodyPathInfo -Body $item -Path $property.Name
        $expected = Resolve-TemplateValue -Value $property.Value -State $State -Iteration $Iteration
        if (-not $actualInfo.Exists -or -not (Test-EqualValue -Actual $actualInfo.Value -Expected $expected)) { $matches = $false; break }
      }
      if ($matches) { throw "$($Definition.name): forbidden array member found at $($definition.path)." }
    }
  }
  foreach ($definition in @(Get-OptionalValue -Object $expectation -Name "allArrayItems" -Default @())) {
    $arrayInfo = Get-BodyPathInfo -Body $Result.Body -Path ([string]$definition.path)
    if (-not $arrayInfo.Exists) { throw "$($Definition.name): expected array missing at $($definition.path)." }
    $expected = Resolve-TemplateValue -Value $definition.value -State $State -Iteration $Iteration
    foreach ($item in @($arrayInfo.Value)) {
      $actualInfo = Get-BodyPathInfo -Body $item -Path ([string]$definition.property)
      if (-not $actualInfo.Exists -or -not (Test-EqualValue -Actual $actualInfo.Value -Expected $expected)) { throw "$($Definition.name): array item mismatch at $($definition.path)." }
    }
  }
  foreach ($definition in @(Get-OptionalValue -Object $expectation -Name "bodyOneOf" -Default @())) {
    $actualInfo = Get-BodyPathInfo -Body $Result.Body -Path ([string]$definition.path)
    if (-not $actualInfo.Exists) { throw "$($Definition.name): bodyOneOf path missing." }
    $allowed = @(Resolve-TemplateValue -Value $definition.values -State $State -Iteration $Iteration)
    if ($allowed.Count -eq 1 -and $allowed[0] -is [System.Array]) { $allowed = @($allowed[0]) }
    $matched = $false
    foreach ($value in $allowed) { if (Test-EqualValue -Actual $actualInfo.Value -Expected $value) { $matched = $true; break } }
    if (-not $matched) { throw "$($Definition.name): body value is not in the allowed set." }
  }

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
    $conflicts = @($Results | Where-Object { $_.Status -eq 409 -and $_.ErrorCode -eq "CALENDAR_VERSION_CONFLICT" })
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
$plainTokenA = Convert-SecureText -Value $TokenA -Label "Token A" -Required ($actors -contains "A")
$plainTokenB = Convert-SecureText -Value $TokenB -Label "Token B" -Required ($actors -contains "B")
$plainTokenC = Convert-SecureText -Value $TokenC -Label "Token C" -Required ($actors -contains "C")
$plainTestKey = Convert-SecureText -Value $PreviewTestKey -Label "Preview test key" -Required (-not (Test-IsLocalOrigin -Origin $ApiOrigin))

$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
$state = @{}
foreach ($entry in $fixtureState.GetEnumerator()) { $state[$entry.Key] = $entry.Value }
$currentCaseId = "initialization"
$failed = $false
try {
  foreach ($case in $selectedCases) {
    $currentCaseId = [string]$case.id
    if ([string]$case.mode -eq "revisionRace") {
      for ($iteration = 1; $iteration -le [int]$case.iterations; $iteration++) {
        foreach ($definition in @($case.baselineRequests)) {
          $result = Invoke-OneRequest -Client $client -Definition $definition -State $state -Iteration $iteration -TokenA $plainTokenA -TokenB $plainTokenB -TokenC $plainTokenC -TestKey $plainTestKey
          Write-Host "PASS $currentCaseId/$($result.Name) iteration $iteration HTTP $($result.Status)"
        }
        $results = @(Invoke-ParallelRequests -Client $client -Definitions @($case.requests) -State $state -Iteration $iteration -TokenA $plainTokenA -TokenB $plainTokenB -TokenC $plainTokenC -TestKey $plainTestKey)
        Assert-AggregateResult -Expectation $case.aggregateExpect -Results $results
        foreach ($definition in @(Get-OptionalValue -Object $case -Name "verifyRequests" -Default @())) {
          $verifyResult = Invoke-OneRequest -Client $client -Definition $definition -State $state -Iteration $iteration -TokenA $plainTokenA -TokenB $plainTokenB -TokenC $plainTokenC -TestKey $plainTestKey
          Write-Host "PASS $currentCaseId/$($verifyResult.Name) iteration $iteration HTTP $($verifyResult.Status)"
        }
        Write-Host "PASS $currentCaseId iteration $iteration aggregate"
      }
      continue
    }

    foreach ($definition in @($case.requests)) {
      $result = Invoke-OneRequest -Client $client -Definition $definition -State $state -Iteration 0 -TokenA $plainTokenA -TokenB $plainTokenB -TokenC $plainTokenC -TestKey $plainTestKey
      $errorSuffix = if ([string]::IsNullOrWhiteSpace([string]$result.ErrorCode)) { "" } else { " $($result.ErrorCode)" }
      Write-Host "PASS $currentCaseId/$($result.Name) HTTP $($result.Status)$errorSuffix"
    }
  }
} catch {
  $failed = $true
  $failureMessage = [string]$_.Exception.Message
  $safeFailureMessage = if (
    $failureMessage.Length -le 200 -and
    $failureMessage -notmatch "(?i)https?://|@|bearer|token|test.?key|[a-f0-9]{16,}|[{}\[\]]"
  ) { $failureMessage } else { "details redacted" }
  Write-Error "Case $currentCaseId failed ($($_.Exception.GetType().Name): $safeFailureMessage); request, response and fixture values omitted."
} finally {
  $client.Dispose()
  $handler.Dispose()
  $plainTokenA = $null
  $plainTokenB = $null
  $plainTokenC = $null
  $plainTestKey = $null
  $state.Clear()
}

if ($failed) { exit 1 }
Write-Host "Calendar Preview contract passed: $($selectedCases.Count) cases."
