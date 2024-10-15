class Bits {
  static splitNumber = (num: number) => {
    if (num < -32768 || num >= 32768) {
      console.error(
        "position out of range, clamping: only have precision for ranges -32768 to 32767",
      );
      if (num < 0) num = -32768;
      else num = 32767;
    }

    const integerPart = Math.floor(num);
    let A: number, B: number;

    if (integerPart < 0) {
      const twosComplement = (1 << 16) + integerPart;
      A = (twosComplement >> 8) & 0xff;
      B = twosComplement & 0xff;
    } else {
      A = (integerPart >> 8) & 0xff;
      B = integerPart & 0xff;
    }

    const fractionalPart = num - integerPart;
    const fractionalBinary = Math.round(fractionalPart * 65535);
    const C = (fractionalBinary >> 8) & 0xff;
    const D = fractionalBinary & 0xff;

    return [A, B, C, D];
  };
}

export { Bits };
