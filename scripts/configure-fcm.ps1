[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$GoogleServicesJson,

    [Parameter(Mandatory = $true)]
    [string]$ServiceAccountJson,

    [switch]$ValidateOnly,
    [switch]$NoExplorer
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$androidPackage = "com.tongkan.mobile"
$accountApiBaseUrl = "https://tongkan-personal.pages.dev/account-api"

function Resolve-RequiredFile([string]$Path, [string]$Label) {
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "$Label path is required."
    }
    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $resolved.Path -PathType Leaf)) {
        throw "$Label file does not exist."
    }
    return [IO.Path]::GetFullPath($resolved.Path)
}

function Assert-OutsideRepository([string]$Path, [string]$Label) {
    $repositoryPrefix = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($Path.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must stay outside the Git repository. Move it to Downloads or C:\tmp and retry."
    }
}

function Require-Text($Value, [string]$Label) {
    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "$Label is missing from the Firebase configuration."
    }
    return $text.Trim()
}

function Set-WorkerSecret([string]$Name, [string]$Value) {
    Write-Host "Configuring Cloudflare Secret: $Name"
    $Value | & pnpm --filter @tongkan/account exec wrangler secret put $Name '--env='
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to configure Cloudflare Secret: $Name"
    }
}

$googleServicesPath = Resolve-RequiredFile $GoogleServicesJson "google-services.json"
$serviceAccountPath = Resolve-RequiredFile $ServiceAccountJson "Firebase service-account JSON"
Assert-OutsideRepository $googleServicesPath "google-services.json"
Assert-OutsideRepository $serviceAccountPath "Firebase service-account JSON"

$googleServices = Get-Content -Raw -Encoding UTF8 -LiteralPath $googleServicesPath | ConvertFrom-Json
$serviceAccount = Get-Content -Raw -Encoding UTF8 -LiteralPath $serviceAccountPath | ConvertFrom-Json

$androidClient = @($googleServices.client) | Where-Object {
    $_.client_info.android_client_info.package_name -eq $androidPackage
} | Select-Object -First 1
if ($null -eq $androidClient) {
    throw "google-services.json does not contain Android package $androidPackage."
}

$projectId = Require-Text $googleServices.project_info.project_id "Firebase project_id"
$senderId = Require-Text $googleServices.project_info.project_number "Firebase project_number"
$applicationId = Require-Text $androidClient.client_info.mobilesdk_app_id "Firebase mobilesdk_app_id"
$apiKeyRecord = @($androidClient.api_key) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.current_key) } | Select-Object -First 1
if ($null -eq $apiKeyRecord) {
    throw "google-services.json does not contain an Android API key."
}
$apiKey = Require-Text $apiKeyRecord.current_key "Firebase Android API key"

$serviceProjectId = Require-Text $serviceAccount.project_id "Service-account project_id"
$clientEmail = Require-Text $serviceAccount.client_email "Service-account client_email"
$privateKey = Require-Text $serviceAccount.private_key "Service-account private_key"
if ($serviceAccount.type -ne "service_account") {
    throw "The server JSON is not a Firebase service-account key."
}
if ($serviceProjectId -ne $projectId) {
    throw "Firebase Android config and service-account JSON belong to different projects."
}

Write-Host "Firebase files validated for $androidPackage. Sensitive values were not printed or copied."
if ($ValidateOnly) {
    return
}

if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME) -and (Test-Path "C:\tmp\android-build\jdk17\jdk-17.0.14+7")) {
    $env:JAVA_HOME = "C:\tmp\android-build\jdk17\jdk-17.0.14+7"
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_HOME) -and (Test-Path "C:\tmp\android-build\android-sdk")) {
    $env:ANDROID_HOME = "C:\tmp\android-build\android-sdk"
}
if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME) -or [string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
    throw "JAVA_HOME and ANDROID_HOME must be configured before building Android."
}

Push-Location $repositoryRoot
try {
    Write-Host "Running Android tests, Lint and provider-enabled APK build..."
    $gradleArguments = @(
        "scripts/run-android-gradle.mjs",
        "testDebugUnitTest",
        "lintDebug",
        "assembleDebug",
        "-PtongkanAccountApiBaseUrl=$accountApiBaseUrl",
        "-PtongkanFcmApiKey=$apiKey",
        "-PtongkanFcmApplicationId=$applicationId",
        "-PtongkanFcmProjectId=$projectId",
        "-PtongkanFcmSenderId=$senderId"
    )
    & node @gradleArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Provider-enabled Android build failed. Cloudflare Secrets were not changed."
    }

    $buildFile = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repositoryRoot "apps\android\app\build.gradle")
    $versionMatch = [regex]::Match($buildFile, 'versionName\s+"([^"]+)"')
    if (-not $versionMatch.Success) {
        throw "Unable to read Android versionName."
    }
    $versionName = $versionMatch.Groups[1].Value
    $sourceApk = Join-Path $repositoryRoot "apps\android\app\build\outputs\apk\debug\app-debug.apk"
    $releaseDirectory = Join-Path $repositoryRoot "release"
    $releaseApk = Join-Path $releaseDirectory "tongkan-android-$versionName-fcm.apk"
    New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
    Copy-Item -Force -LiteralPath $sourceApk -Destination $releaseApk

    Set-WorkerSecret "FCM_PROJECT_ID" $projectId
    Set-WorkerSecret "FCM_CLIENT_EMAIL" $clientEmail
    Set-WorkerSecret "FCM_PRIVATE_KEY" $privateKey

    Write-Host "Deploying Account Worker with FCM enabled..."
    & pnpm --filter @tongkan/account exec wrangler deploy '--env='
    if ($LASTEXITCODE -ne 0) {
        throw "Account Worker deployment failed."
    }

    $health = Invoke-RestMethod -Uri "https://tongkan-personal.pages.dev/account-api/health" -Method Get
    if (-not $health.ok -or $health.testMode) {
        throw "Production account health check failed."
    }

    $hash = Get-FileHash -LiteralPath $releaseApk -Algorithm SHA256
    Write-Host "FCM APK ready: $releaseApk"
    Write-Host "SHA-256: $($hash.Hash)"
    if (-not $NoExplorer) {
        $explorerArgument = '/select,"' + $releaseApk + '"'
        Start-Process explorer.exe -ArgumentList $explorerArgument
    }
} finally {
    Pop-Location
}
