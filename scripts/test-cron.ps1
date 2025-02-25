#!/usr/bin/env pwsh
<#
.SYNOPSIS
Tests a cron job endpoint directly

.DESCRIPTION
This script allows testing cron job endpoints without waiting for scheduled execution

.PARAMETER Path
The cron job path to test, defaults to /api/cron/fetch-tweets

.PARAMETER DevSecret
The development secret for authentication, defaults to the DEV_SECRET environment variable

.PARAMETER BaseUrl
Base URL of the application, defaults to NEXT_PUBLIC_URL environment variable or http://localhost:3000

.PARAMETER Verbose
Shows additional debug information about the requests

.PARAMETER FetchLogs
When set, attempts to fetch recent Vercel logs for the project (requires Vercel CLI to be installed)

.EXAMPLE
.\test-cron.ps1
Tests the default fetch-tweets cron job

.EXAMPLE
.\test-cron.ps1 -Path "/api/cron/rotate-logs" -DevSecret "mysecret123"
Tests the rotate-logs cron job with a specific secret

.EXAMPLE
.\test-cron.ps1 -Verbose -FetchLogs
Tests the default cron job with detailed logging and fetches recent Vercel logs
#>

param(
    [string]$Path = "/api/cron/fetch-tweets",
    [string]$DevSecret = $env:DEV_SECRET,
    [string]$BaseUrl = $env:NEXT_PUBLIC_URL,
    [switch]$Verbose,
    [switch]$FetchLogs
)

# Set defaults if not provided
if (-not $BaseUrl) {
    $BaseUrl = "https://amore.build"
}

if (-not $DevSecret) {
    $DevSecret = $env:CRON_SECRET
    if (-not $DevSecret) {
        Write-Error "Error: DEV_SECRET or CRON_SECRET environment variable is required"
        exit 1
    }
}

# Method 1: Test using the dev test endpoint
$DevTestUrl = "${BaseUrl}/api/dev/test-cron?path=${Path}"
Write-Host "Testing via development endpoint: $DevTestUrl"

if ($Verbose) {
    Write-Host "`nRequest details:" -ForegroundColor Cyan
    Write-Host "Authorization: Bearer $($DevSecret.Substring(0, 3))..." -ForegroundColor Cyan
    Write-Host "URL: $DevTestUrl" -ForegroundColor Cyan
}

try {
    $DevResponse = Invoke-RestMethod -Uri $DevTestUrl -Headers @{
        "Authorization" = "Bearer $DevSecret"
        "Content-Type" = "application/json"
    } -Method Get -ErrorAction Stop

    Write-Host "Development endpoint test successful:" -ForegroundColor Green
    
    if ($Verbose) {
        Write-Host "`nFull response:" -ForegroundColor Cyan
        $DevResponse | ConvertTo-Json -Depth 10
    } else {
        $DevResponse | ConvertTo-Json -Depth 5
    }
    
    # Check if the underlying cron job had an error
    if ($DevResponse.cronResponse.error -or $DevResponse.responseStatus -ge 400) {
        Write-Host "`nWarning: The development endpoint succeeded, but the cron job itself failed:" -ForegroundColor Yellow
        
        if ($DevResponse.cronResponse.error) {
            Write-Host "Error details:" -ForegroundColor Yellow
            $DevResponse.cronResponse.error | ConvertTo-Json -Depth 3
        }
        
        if ($DevResponse.responseStatus -ge 400) {
            Write-Host "Response status: $($DevResponse.responseStatus) $($DevResponse.responseInfo.statusText)" -ForegroundColor Yellow
        }
        
        Write-Host "`nTry running with the -Verbose parameter to see more details" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Development endpoint test failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "Status code: $($_.Exception.Response.StatusCode.value__)"
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorContent = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorContent | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

Write-Host "`n----------------------------------------`n"

# Method 2: Test the endpoint directly with the dev_key parameter
$DirectTestUrl = "${BaseUrl}${Path}?dev_key=${DevSecret}&test=true"
Write-Host "Testing by calling endpoint directly: $DirectTestUrl"

if ($Verbose) {
    Write-Host "`nDirect request details:" -ForegroundColor Cyan
    Write-Host "URL: $DirectTestUrl" -ForegroundColor Cyan
    Write-Host "No Authorization header (using dev_key in query)" -ForegroundColor Cyan
}

try {
    $DirectResponse = Invoke-RestMethod -Uri $DirectTestUrl -Method Get -ErrorAction Stop

    Write-Host "Direct endpoint test successful:" -ForegroundColor Green
    
    if ($Verbose) {
        Write-Host "`nFull response:" -ForegroundColor Cyan
        $DirectResponse | ConvertTo-Json -Depth 10
    } else {
        $DirectResponse | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "Direct endpoint test failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "Status code: $($_.Exception.Response.StatusCode.value__)"
    
    if ($Verbose) {
        Write-Host "`nDetailed error information:" -ForegroundColor Red
        Write-Host "Exception type: $($_.Exception.GetType().FullName)"
        Write-Host "Status description: $($_.Exception.Response.StatusDescription)"
    }
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorContent = $_.ErrorDetails.Message | ConvertFrom-Json
            
            if ($Verbose) {
                Write-Host "`nResponse content:" -ForegroundColor Red
                $errorContent | ConvertTo-Json -Depth 10
            } else {
                $errorContent | ConvertTo-Json -Depth 5
            }
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

# Fetch logs from Vercel if requested and Vercel CLI is installed
if ($FetchLogs) {
    Write-Host "`n----------------------------------------`n"
    Write-Host "Fetching recent Vercel logs..." -ForegroundColor Cyan
    
    # Check if Vercel CLI is installed
    $hasVercel = $null -ne (Get-Command -Name "vercel" -ErrorAction SilentlyContinue)
    
    if (-not $hasVercel) {
        Write-Host "Vercel CLI not found. Please install it with 'npm i -g vercel' to use this feature." -ForegroundColor Red
    } else {
        # Extract the path portion for log filtering
        $pathForFilter = $Path.TrimStart('/')
        
        # Try to get the logs
        try {
            Write-Host "Fetching logs for $pathForFilter..."
            $logs = vercel logs --limit 50 | Out-String
            
            # Filter logs to show only relevant ones if possible
            if ($logs) {
                if ($logs -match $pathForFilter) {
                    Write-Host "Found logs mentioning $pathForFilter:" -ForegroundColor Green
                    Write-Host ($logs -split "`n" | Select-String -Pattern $pathForFilter -Context 5,5)
                } else {
                    Write-Host "No logs found specifically for $pathForFilter. Showing most recent logs:" -ForegroundColor Yellow
                    Write-Host $logs
                }
            } else {
                Write-Host "No logs returned from Vercel." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Error fetching Vercel logs: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} 