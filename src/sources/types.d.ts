export interface SourceModuleInfo {
  id: string;
  name: string;
  version: string;
}

export interface SourceSearchItem {
  id: string | number;
  title: string;
  originalTitle?: string;
  image?: string | null;
  score?: number | string;
  url?: string;
  kind?: string;
  /** internal: registry will inject source id for cross-source handling */
  __sourceId?: string;
}

export type StreamType = 'hls' | 'mp4';

export interface SourceStream {
  url: string;
  type: StreamType;
  quality?: string;
  headers?: Record<string, string>;
}

export interface SourceModule {
  info: SourceModuleInfo;
  search(query: string, opts?: { page?: number; limit?: number }): Promise<SourceSearchItem[]>;
  getById?(id: string | number): Promise<any>;
  getStreams?(id: string | number, opts?: { episode?: number | string }): Promise<SourceStream[]>;
}


