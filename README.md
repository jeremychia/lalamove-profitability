# 🏍️ Lalamove Profitability Calculator

A web-based tool for Singapore motorcycle delivery riders to quickly assess whether a Lalamove order is worth taking.

## 🚀 Quick Start

**Live Site:** [https://jeremychia.github.io/lalamove-profitability/](https://jeremychia.github.io/lalamove-profitability/)

## ✨ Features

### Core Calculator

- 📍 **Multi-stop route calculation** using Singapore's OneMap API
- 📱 **GPS location support** - tap to use your current location
- ⛽ **Fuel cost estimation** based on your motorcycle model (10+ bikes supported)
- ⏱️ **Smart wait time prediction** based on building type (HDB, condo, office, mall, etc.)
- 🚦 **Traffic-aware timing** - auto-detects peak hours in Singapore
- 💰 **Profitability rating** with $/hour breakdown

### Fare Breakdown

- 💵 **Lalamove deductions breakdown** - see exactly what you earn
  - 15% commission (on base fare)
  - 9% VAT/GST
  - $0.50 platform fee offset
  - CPF withholding (placeholder for Platform Worker's Act)
- 📊 **Net profit calculation** after all deductions and fuel costs

### Efficiency Guide

- 📈 **Multi-stop efficiency analysis** - understand why 2-3 stop orders pay better
- 🎯 **Scenario comparisons** - see $/hour for typical order types
- ✅ **Decision framework** - quick take/consider/avoid guidelines
- 🏢 **Wait time reference** - by building type

### User Experience

- 🗺️ **Open in Google Maps** - one tap to navigate your route
- 🏷️ **Building type badges** - see HDB/Condo/Office inside inputs
- 📱 **Mobile-optimized** - compact single-line layout for small screens
- ⚙️ **Customizable settings** - petrol price, bike model, API token

## 🎮 How It Works

1. **Enter locations** - your current location (or tap 📍 for GPS), pickup, and delivery stops
2. **Enter the fare** - the amount shown in Lalamove app
3. **Get instant analysis** - profitability rating, fare breakdown, and $/hour

## 🔧 Technical Details

### Built With

- Vanilla JavaScript (ES Modules)
- OneMap Singapore API for geocoding & routing
- GitHub Pages for hosting
- GitHub Actions for CI/CD with secrets injection

### Project Structure

```
docs/
├── index.html          # Main calculator
├── guide.html          # Efficiency guide page
├── style.css           # Mobile-first styles
└── js/
    ├── main.js         # App entry point
    ├── config.js       # Constants & configuration
    ├── api/            # OneMap API client
    ├── services/       # Business logic (routing, fuel, profitability)
    ├── ui/             # UI components & rendering
    └── utils/          # Validation & formatting
```

### Local Development

```bash
# Serve locally
cd docs && python -m http.server 8000

# Run pre-commit hooks
pre-commit run --all-files
```

### OneMap API Token (Optional)

For accurate routing, get a free API token from [OneMap](https://www.onemap.gov.sg/apidocs/). Without it, distances are estimated using straight-line calculations.

## 📖 Documentation

For detailed documentation on cost estimation, technical implementation, and rider tips, see [DOCUMENTATION.md](./DOCUMENTATION.md).

## 📄 License

MIT License
