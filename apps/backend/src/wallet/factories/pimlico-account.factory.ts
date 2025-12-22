// Deprecated: ERC-4337 Pimlico factory removed in favor of native EOA + EIP-7702.
export class PimlicoAccountFactory {
  constructor() {
    throw new Error(
      'PimlicoAccountFactory (ERC-4337) is removed. Use NativeEoaFactory or Eip7702AccountFactory.',
    );
  }
}

export default PimlicoAccountFactory;
