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

.PARAMETER Method
The test method to use: "dev" for development endpoint, "direct" for direct endpoint, or "both" for both (default)

.EXAMPLE
.\test-cron.ps1
Tests the default fetch-tweets cron job using both methods

.EXAMPLE
.\test-cron.ps1 -Path "/api/cron/rotate-logs" -DevSecret "mysecret123"
Tests the rotate-logs cron job with a specific secret

.EXAMPLE
.\test-cron.ps1 -Verbose -FetchLogs
Tests the default cron job with detailed logging and fetches recent Vercel logs

.EXAMPLE
.\test-cron.ps1 -Method "dev"
Tests only using the development endpoint, avoiding duplicate calls
#>

param(
    [string]$Path = "/api/cron/fetch-tweets",
    [string]$DevSecret = $env:DEV_SECRET,
    [string]$BaseUrl = $env:NEXT_PUBLIC_URL,
    [switch]$Verbose,
    [switch]$FetchLogs,
    [ValidateSet("dev", "direct", "both")]
    [string]$Method = "both"
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

# Variables to store responses
$DevResponse = $null
$DirectResponse = $null

# Method 1: Test using the dev test endpoint
if ($Method -eq "dev" -or $Method -eq "both") {
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

    if ($Method -eq "both") {
        Write-Host "`n----------------------------------------`n"
    }
}

# Method 2: Test the endpoint directly with the dev_key parameter
if ($Method -eq "direct" -or $Method -eq "both") {
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
                $DirectResponse = $errorContent  # Store the error response for analysis
                
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
        
        # First make sure we're logged in and have a project linked
        try {
            $projectInfo = vercel project ls --json | ConvertFrom-Json
            
            # If we got no projects or an error, we might not be logged in
            if (-not $projectInfo -or $projectInfo.error) {
                Write-Host "Please make sure you're logged in with 'vercel login' and have a project linked with 'vercel link'" -ForegroundColor Yellow
                return
            }
            
            # Try to get the logs - Vercel CLI requires a deployment ID/URL
            Write-Host "Retrieving latest production deployment..."
            $deployments = vercel list --prod --json | ConvertFrom-Json
            
            if ($deployments -and $deployments.Count -gt 0) {
                $latestDeployment = $deployments[0].url
                
                Write-Host "Fetching logs for ${pathForFilter} from $latestDeployment..."
                $logs = vercel logs $latestDeployment | Out-String
                
                # Filter logs to show only relevant ones if possible
                if ($logs) {
                    if ($logs -match $pathForFilter) {
                        Write-Host "Found logs mentioning ${pathForFilter}:" -ForegroundColor Green
                        Write-Host ($logs -split "`n" | Select-String -Pattern $pathForFilter -Context 5,5)
                    } else {
                        Write-Host "No logs found specifically for ${pathForFilter}. Showing most recent logs:" -ForegroundColor Yellow
                        Write-Host $logs
                    }
                } else {
                    Write-Host "No logs returned from Vercel." -ForegroundColor Yellow
                }
            } else {
                Write-Host "No deployments found. Make sure you have deployed your project to Vercel." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Error fetching Vercel logs: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`n----------------------------------------`n"

# Analyze the responses to determine what happened
# First, check if we have any responses to analyze
if (($Method -eq "dev" -or $Method -eq "both") -and $DevResponse -ne $null) {
    $responseToAnalyze = $DevResponse.cronResponse
    $errorSource = "Development endpoint"
    
    # For dev endpoint, the error might be nested in cronResponse
    if ($responseToAnalyze.error) {
        $errorDetails = $responseToAnalyze.error
    } else {
        $errorDetails = $responseToAnalyze
    }
} elseif (($Method -eq "direct" -or $Method -eq "both") -and $DirectResponse -ne $null) {
    $responseToAnalyze = $DirectResponse
    $errorSource = "Direct endpoint"
    
    # For direct endpoint, the error might be at the top level
    if ($responseToAnalyze.error) {
        $errorDetails = $responseToAnalyze.error
    } else {
        $errorDetails = $responseToAnalyze
    }
} else {
    Write-Host "No response data available for analysis." -ForegroundColor Yellow
    exit
}

# Check for specific error types
if ($errorDetails) {
    # Check for rate limit errors (429)
    if ($errorDetails.code -eq "TWITTER_RATE_LIMIT" -or 
        $errorDetails.code -eq "RATE_LIMIT_EXCEEDED" -or
        $errorDetails.message -match "429" -or
        $errorDetails.message -match "rate limit") {
        
        Write-Host "TWITTER RATE LIMIT DETECTED" -ForegroundColor Red -BackgroundColor Black
        
        Write-Host "`nTwitter API rate limits typically reset after 15 minutes." -ForegroundColor Yellow
        Write-Host "Options to resolve this issue:" -ForegroundColor Cyan
        Write-Host "1. Wait for rate limit to reset (typically 15 minutes)" -ForegroundColor White
        Write-Host "2. Check your Twitter API credential limits in the Twitter Developer Portal" -ForegroundColor White
        Write-Host "3. Reduce the frequency of your API calls" -ForegroundColor White
        Write-Host "4. If available, use cached tweets from the database" -ForegroundColor White
        
        if ($errorDetails.resetAt) {
            Write-Host "`nRate limit will reset at: $($errorDetails.resetAt)" -ForegroundColor Yellow
        }
    }
    # Check for invalid request errors (400)
    elseif ($errorDetails.code -eq "INVALID_REQUEST" -or
            $errorDetails.message -match "400" -or
            $errorDetails.message -match "Invalid Request" -or
            $errorDetails.message -match "invalid parameters") {
        
        Write-Host "TWITTER API INVALID REQUEST DETECTED" -ForegroundColor Red -BackgroundColor Black
        
        Write-Host "`nThe Twitter API rejected the request due to invalid parameters." -ForegroundColor Yellow
        Write-Host "Options to resolve this issue:" -ForegroundColor Cyan
        Write-Host "1. Check that all parameters are in the correct format (comma-separated strings, not arrays)" -ForegroundColor White
        Write-Host "2. Verify your Twitter API query syntax is correct" -ForegroundColor White
        Write-Host "3. Review the Twitter API documentation: https://developer.twitter.com/en/docs/twitter-api" -ForegroundColor White
        Write-Host "4. Check that you have sufficient permissions for this request" -ForegroundColor White
        
        Write-Host "`nError message: $($errorDetails.message)" -ForegroundColor Yellow
    }
    # Check for network errors
    elseif ($errorDetails.code -eq "TWITTER_NETWORK_ERROR" -or
            $errorDetails.message -match "timeout" -or
            $errorDetails.message -match "network" -or
            $errorDetails.message -match "Request failed") {
        
        Write-Host "TWITTER API NETWORK ERROR DETECTED" -ForegroundColor Red -BackgroundColor Black
        
        Write-Host "`nThere was a network error while connecting to the Twitter API." -ForegroundColor Yellow
        Write-Host "Options to resolve this issue:" -ForegroundColor Cyan
        Write-Host "1. Check your internet connection" -ForegroundColor White
        Write-Host "2. Verify that X/Twitter services are online" -ForegroundColor White
        Write-Host "3. Check if your API credentials have been revoked or expired" -ForegroundColor White
        Write-Host "4. Examine if there are any IP restrictions on your Twitter developer account" -ForegroundColor White
        Write-Host "5. Verify that your Twitter API endpoint URL is correct" -ForegroundColor White
        
        Write-Host "`nError message: $($errorDetails.message)" -ForegroundColor Yellow
        
        if ($Verbose -and $errorDetails.details -and $errorDetails.details.stack) {
            Write-Host "`nStack trace:" -ForegroundColor Yellow
            Write-Host $errorDetails.details.stack -ForegroundColor Gray
        }
    }
    # Check for authentication errors
    elseif ($errorDetails.code -eq "UNAUTHORIZED" -or
            $errorDetails.message -match "401" -or
            $errorDetails.message -match "auth" -or
            $errorDetails.message -match "credentials") {
        
        Write-Host "TWITTER API AUTHENTICATION ERROR DETECTED" -ForegroundColor Red -BackgroundColor Black
        
        Write-Host "`nThe Twitter API rejected your authentication credentials." -ForegroundColor Yellow
        Write-Host "Options to resolve this issue:" -ForegroundColor Cyan
        Write-Host "1. Verify that your Twitter API credentials are correct" -ForegroundColor White
        Write-Host "2. Check if your API keys have been revoked or expired" -ForegroundColor White
        Write-Host "3. Ensure that your Twitter developer account is in good standing" -ForegroundColor White
        
        Write-Host "`nError message: $($errorDetails.message)" -ForegroundColor Yellow
    }
    # Generic error fallback
    else {
        Write-Host "TWITTER API ERROR DETECTED" -ForegroundColor Red -BackgroundColor Black
        
        Write-Host "`nAn error occurred while communicating with the Twitter API." -ForegroundColor Yellow
        Write-Host "Error details:" -ForegroundColor Cyan
        Write-Host "Code: $($errorDetails.code)" -ForegroundColor White
        Write-Host "Message: $($errorDetails.message)" -ForegroundColor White
        
        if ($Verbose -and $errorDetails.details) {
            Write-Host "`nAdditional details:" -ForegroundColor Yellow
            $errorDetails.details | ConvertTo-Json -Depth 3
        }
    }
}
# Check for successful responses
elseif (
    # For dev endpoint
    ($Method -eq "dev" -and $DevResponse -and $DevResponse.status -eq "success" -and 
     $DevResponse.cronResponse.status -eq "success" -and
     ($DevResponse.cronResponse.tweetCount -gt 0 -or 
      ($DevResponse.cronResponse.source -eq "cache" -and $DevResponse.cronResponse.tweetCount -ne $null))) -or
    
    # For direct endpoint
    ($Method -eq "direct" -and $DirectResponse -and $DirectResponse.status -eq "success" -and
     ($DirectResponse.tweetCount -gt 0 -or 
      ($DirectResponse.source -eq "cache" -and $DirectResponse.tweetCount -ne $null))) -or
    
    # For both endpoints (either one succeeding)
    ($Method -eq "both" -and (
        ($DevResponse -and $DevResponse.status -eq "success" -and 
         $DevResponse.cronResponse.status -eq "success" -and
         ($DevResponse.cronResponse.tweetCount -gt 0 -or 
          ($DevResponse.cronResponse.source -eq "cache" -and $DevResponse.cronResponse.tweetCount -ne $null))) -or
        ($DirectResponse -and $DirectResponse.status -eq "success" -and
         ($DirectResponse.tweetCount -gt 0 -or 
          ($DirectResponse.source -eq "cache" -and $DirectResponse.tweetCount -ne $null)))
    ))
) {
    Write-Host "TWITTER API REQUEST SUCCESSFUL!" -ForegroundColor Green -BackgroundColor Black
    
    # Show details from the successful response
    if ($Method -ne "direct" -and $DevResponse -and $DevResponse.status -eq "success" -and 
        $DevResponse.cronResponse.status -eq "success" -and
        ($DevResponse.cronResponse.tweetCount -gt 0 -or 
         ($DevResponse.cronResponse.source -eq "cache" -and $DevResponse.cronResponse.tweetCount -ne $null))) {
        
        $tweetCount = $DevResponse.cronResponse.tweetCount
        $source = $DevResponse.cronResponse.source
        
        Write-Host "`nDev endpoint response:" -ForegroundColor Green
        Write-Host "Tweet count: $tweetCount" -ForegroundColor White
        Write-Host "Source: $source" -ForegroundColor White
        
        if ($DevResponse.cronResponse.newTweets -ne $null) {
            Write-Host "New tweets: $($DevResponse.cronResponse.newTweets)" -ForegroundColor White
        }
        
        if ($DevResponse.cronResponse.filteredCount -ne $null) {
            Write-Host "Filtered count: $($DevResponse.cronResponse.filteredCount)" -ForegroundColor White
        }
    }
    
    if ($Method -ne "dev" -and $DirectResponse -and $DirectResponse.status -eq "success" -and
        ($DirectResponse.tweetCount -gt 0 -or 
         ($DirectResponse.source -eq "cache" -and $DirectResponse.tweetCount -ne $null))) {
        
        $tweetCount = $DirectResponse.tweetCount
        $source = $DirectResponse.source
        
        Write-Host "`nDirect endpoint response:" -ForegroundColor Green
        Write-Host "Tweet count: $tweetCount" -ForegroundColor White
        Write-Host "Source: $source" -ForegroundColor White
        
        if ($DirectResponse.newTweets -ne $null) {
            Write-Host "New tweets: $($DirectResponse.newTweets)" -ForegroundColor White
        }
        
        if ($DirectResponse.filteredCount -ne $null) {
            Write-Host "Filtered count: $($DirectResponse.filteredCount)" -ForegroundColor White
        }
    }
    
    Write-Host "`nThe Twitter API request completed successfully." -ForegroundColor Green
    Write-Host "Your cron job is working properly!" -ForegroundColor Green
}
else {
    # Catch-all for confusing status cases - could be partial success or odd error format
    Write-Host "INCONSISTENT OR EMPTY RESPONSE DETECTED" -ForegroundColor Yellow -BackgroundColor Black
    
    Write-Host "`nYour request received a response, but it doesn't contain the expected data." -ForegroundColor Yellow
    Write-Host "This could indicate:" -ForegroundColor Cyan
    Write-Host "1. A successful connection but no content found (empty tweet list)" -ForegroundColor White
    Write-Host "2. A problem with parsing the Twitter API response" -ForegroundColor White
    Write-Host "3. A successful connection to cache but the cache is empty" -ForegroundColor White
    
    if ($Method -ne "direct" -and $DevResponse) {
        Write-Host "`nDev endpoint details:" -ForegroundColor Yellow
        Write-Host "Status: $($DevResponse.status)" -ForegroundColor White
        
        if ($DevResponse.cronResponse) {
            if ($DevResponse.cronResponse.status) {
                Write-Host "Cron response status: $($DevResponse.cronResponse.status)" -ForegroundColor White
            }
            if ($DevResponse.cronResponse.tweetCount -ne $null) {
                Write-Host "Tweet count: $($DevResponse.cronResponse.tweetCount)" -ForegroundColor White
            }
            if ($DevResponse.cronResponse.source) {
                Write-Host "Source: $($DevResponse.cronResponse.source)" -ForegroundColor White
            }
        }
    }
    
    if ($Method -ne "dev" -and $DirectResponse) {
        Write-Host "`nDirect endpoint details:" -ForegroundColor Yellow
        Write-Host "Status: $($DirectResponse.status)" -ForegroundColor White
        
        if ($DirectResponse.tweetCount -ne $null) {
            Write-Host "Tweet count: $($DirectResponse.tweetCount)" -ForegroundColor White
        }
        if ($DirectResponse.source) {
            Write-Host "Source: $($DirectResponse.source)" -ForegroundColor White
        }
    }
    
    Write-Host "`nCheck the cron job logs for more detailed information." -ForegroundColor Yellow
} 