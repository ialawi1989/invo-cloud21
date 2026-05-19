// Content Type Filter Definitions
export const filterTypes = [
  {
    text: 'Image',
    value: 'image',
    checked: false,
  },
  {
    text: 'Document',
    value: 'document',
    checked: false,
  },
  {
    text: 'Video',
    value: 'video',
    checked: false,
  },
  {
    text: 'Audio',
    value: 'audio',
    checked: false,
  },
  {
    text: '3D Model',
    value: 'model',
    checked: false,
  }
];

export interface FilterType {
  text: string;
  value: string;
  checked: boolean;
}
