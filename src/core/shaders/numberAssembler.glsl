float assembleNumber(int A, int B, int C, int D) {
  int preIntPart = A * 256 + B;
  int integerPart = A < 128 ? preIntPart : preIntPart - 65536;
  int fractionalBinary = C * 256 + D;
  float fractionalPart = float(fractionalBinary) / 65535.0;

  return float(integerPart) + fractionalPart;
}
