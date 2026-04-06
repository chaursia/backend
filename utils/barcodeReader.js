const { MultiFormatReader, BarcodeFormat, DecodeHintType, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } = require('@zxing/library');
const Jimp = require('jimp');

/**
 * Utility to extract barcode from an image buffer.
 * @param {Buffer} imageBuffer - The image file buffer.
 * @returns {Promise<string|null>} - The decoded barcode or null if not found.
 */
async function readBarcode(imageBuffer) {
    try {
        const image = await Jimp.read(imageBuffer);
        const { width, height } = image.bitmap;
        
        // Convert Jimp image to RGBLuminanceSource
        const luminanceSource = new RGBLuminanceSource(
            new Int32Array(image.bitmap.data.buffer),
            width,
            height
        );

        const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
        
        const hints = new Map();
        const formats = [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.QR_CODE
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new MultiFormatReader();
        const result = reader.decode(binaryBitmap, hints);

        return result.getText();
    } catch (error) {
        // ZXing throws an error if no barcode is found
        console.warn('Barcode extraction failed or no barcode found:', error.message || error);
        return null;
    }
}

module.exports = { readBarcode };
