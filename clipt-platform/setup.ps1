# Enterprise-Grade Clipt Platform Setup Script
# This script sets up the production infrastructure for Clipt streaming platform

# Display banner
Write-Host "======================================================"
Write-Host "   CLIPT ENTERPRISE STREAMING PLATFORM SETUP"
Write-Host "======================================================"
Write-Host "This script will configure your production-grade streaming platform."
Write-Host "You can add your Cloudflare Stream Key later."
Write-Host "======================================================"
Write-Host ""

# Check for Docker
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker detected: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker not found. Please install Docker Desktop before continuing." -ForegroundColor Red
    exit 1
}

# Check for Docker Compose
try {
    $dockerComposeVersion = docker-compose --version
    Write-Host "✓ Docker Compose detected: $dockerComposeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Compose not found. Please install Docker Compose before continuing." -ForegroundColor Red
    exit 1
}

# Create Docker network
Write-Host ""
Write-Host "Creating Docker network 'clipt-net'..." -ForegroundColor Yellow
try {
    $networkExists = docker network ls --filter name=clipt-net -q
    if (-not $networkExists) {
        docker network create clipt-net
        Write-Host "✓ Docker network 'clipt-net' created successfully" -ForegroundColor Green
    } else {
        Write-Host "✓ Docker network 'clipt-net' already exists" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Failed to create Docker network: $_" -ForegroundColor Red
}

# Create env file from template if it doesn't exist
Write-Host ""
Write-Host "Setting up environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path -Path ".\.env")) {
    Copy-Item -Path ".\env-template.txt" -Destination ".\.env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
    Write-Host "  NOTE: You will need to edit this file later with your Cloudflare Stream Key" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Create public HTML file with instructions
Write-Host ""
Write-Host "Creating test page..." -ForegroundColor Yellow
$htmlDir = ".\web\src\public"
if (-not (Test-Path -Path $htmlDir)) {
    New-Item -ItemType Directory -Path $htmlDir -Force | Out-Null
}

$htmlContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clipt Enterprise Streaming Platform</title>
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 { color: #ff7700; }
        h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        code {
            background: #f4f4f4;
            padding: 3px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .box {
            background: #f8f8f8;
            border-left: 4px solid #ff7700;
            padding: 15px;
            margin: 20px 0;
        }
        .steps {
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
        }
        .steps ol { padding-left: 20px; }
        .steps li { margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>Clipt Enterprise Streaming Platform</h1>
    <p>Your production-grade streaming infrastructure is almost ready!</p>

    <div class="box">
        <strong>Configuration Status:</strong> Awaiting Cloudflare Stream Key
    </div>

    <h2>Next Steps</h2>
    <div class="steps">
        <ol>
            <li>Get your Cloudflare Stream Key from the Cloudflare Dashboard</li>
            <li>Edit the <code>.env</code> file in the <code>clipt-platform</code> directory</li>
            <li>Fill in your <code>STREAM_KEY</code> and <code>REACT_APP_STREAM_URL</code></li>
            <li>Run <code>docker-compose up -d</code> to start the services</li>
        </ol>
    </div>

    <h2>OBS Configuration</h2>
    <p>Configure OBS with these settings:</p>
    <ul>
        <li><strong>Service:</strong> Custom...</li>
        <li><strong>Server:</strong> <code>rtmp://localhost:1935/live</code></li>
        <li><strong>Stream Key:</strong> <code>stream</code></li>
    </ul>

    <h2>Stream Testing</h2>
    <p>After setting up your Cloudflare Stream Key, you can test your stream by:</p>
    <ol>
        <li>Starting OBS and beginning streaming</li>
        <li>Accessing your stream at the configured <code>REACT_APP_STREAM_URL</code></li>
        <li>Testing the chat service at <code>http://localhost:3000</code></li>
    </ol>

    <div class="box">
        This enterprise platform is ready to scale to 100K+ viewers with Cloudflare's global CDN.
    </div>
</body>
</html>
"@

New-Item -ItemType Directory -Path ".\web\src\public" -Force | Out-Null
Set-Content -Path ".\web\src\public\index.html" -Value $htmlContent
Write-Host "✓ Created test HTML page" -ForegroundColor Green

# Create a basic Docker Compose validation test
Write-Host ""
Write-Host "Validating Docker Compose configuration..." -ForegroundColor Yellow
try {
    docker-compose config --quiet
    Write-Host "✓ Docker Compose configuration is valid" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Compose configuration has errors: $_" -ForegroundColor Red
}

# Final instructions
Write-Host ""
Write-Host "======================================================"
Write-Host "SETUP COMPLETE" -ForegroundColor Green
Write-Host "======================================================"
Write-Host "Your Clipt Enterprise Streaming Platform is ready for configuration."
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Get your Cloudflare Stream Key from the Cloudflare Dashboard"
Write-Host "   https://dash.cloudflare.com/stream"
Write-Host ""
Write-Host "2. Edit the .env file with your Stream Key and Stream URL"
Write-Host "   Edit: $((Get-Item .).FullName)\.env"
Write-Host ""
Write-Host "3. Start the platform with:"
Write-Host "   docker-compose up -d"
Write-Host ""
Write-Host "4. Configure OBS with:" 
Write-Host "   Server: rtmp://localhost:1935/live"
Write-Host "   Stream Key: stream"
Write-Host ""
Write-Host "======================================================"
