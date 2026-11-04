export interface Checkpoint {
  key: string;
  label: string;
}

export interface WidgetProps {
  checkpoints: Checkpoint[];
  done: ReadonlySet<string>;
  onDone: (key: string) => void;
  instructions: string;
}

export interface AssetRef {
  assetId: string;
  frameCount: number;
}
