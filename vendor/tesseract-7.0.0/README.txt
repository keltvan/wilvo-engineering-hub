Tesseract OCR voor WILVO Tekening uitlezen — lokaal meegeleverd, geen CDN.

tesseract.js       7.0.0   (Apache-2.0)  tesseract.min.js, worker.min.js
tesseract.js-core  7.0.0   (Apache-2.0)  core/tesseract-core-{lstm,simd-lstm,relaxedsimd-lstm}.wasm.js
@tesseract.js-data/eng 1.0.0, 4.0.0_best_int (Apache-2.0)  lang/eng.traineddata.gz

Bron: npm via cdn.jsdelivr.net, SHA-256 gecontroleerd tegen de pakketmetadata.
Alleen de LSTM-kernen zijn nodig: de reader start Tesseract met OEM 1 (LSTM).
