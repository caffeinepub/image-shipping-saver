# Image Shipping Saver

## Current State
App has image compression tool with fake shipping charge estimates based on image file size.

## Requested Changes (Diff)

### Add
- Weight-based Meesho/Flipkart shipping calculator section
- Product weight input (grams)
- Real shipping charge display based on actual platform rate cards
- Support for multiple platforms: Meesho, Flipkart, Amazon, Shiprocket

### Modify
- Remove fake shipping charge estimates from compressed image cards
- Image compression section stays but without fake shipping numbers
- Hero text updated to reflect weight calculator feature

### Remove
- `getShippingCharge(bytes)` function and all related fake estimate UI
- Shipping charge badges on compressed image results
- "Save ₹X" shipping savings badges

## Implementation Plan
1. Remove getShippingCharge function and all fake estimate UI from image cards
2. Add a new prominent section: "Shipping Charge Calculator" with weight input
3. Real rate cards hardcoded:
   - Meesho: 0-500g=₹40, 501-1000g=₹58, 1001-2000g=₹78, 2001-5000g=₹108
   - Flipkart: 0-500g=₹45, 501-1000g=₹65, 1001-2000g=₹85, 2001-5000g=₹115
   - Amazon: 0-500g=₹42, 501-1000g=₹62, 1001-2000g=₹82, 2001-5000g=₹112
   - Shiprocket: 0-500g=₹38, 501-1000g=₹55, 1001-2000g=₹75, 2001-5000g=₹105
4. Show all 4 platforms side by side after weight is entered
5. Image compression tool remains as a separate utility section
