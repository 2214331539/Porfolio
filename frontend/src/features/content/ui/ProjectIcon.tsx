import { useState } from 'react';
import { AudioLines, Blocks, CookingPot, MapPin, Nfc } from 'lucide-react';
import type { ProjectInput } from '../../../entities/project/model/projects';
import { portfolioAssetUrl } from '../api/portfolio-api';

const icons = { couploc: MapPin, soundtag: Nfc, cooking: CookingPot, impromptu: AudioLines, shopify: Blocks, default: Blocks };

function IconImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <Blocks aria-hidden="true" strokeWidth={1.5}/> : <img src={portfolioAssetUrl(url)} alt="" loading="lazy" onError={() => setFailed(true)}/>;
}

export function ProjectIcon({ project }: { project: Pick<ProjectInput, 'icon_key' | 'icon_url'> }) {
  const Icon = icons[project.icon_key] ?? Blocks;
  return <span className="work-icon">{project.icon_url ? <IconImage key={project.icon_url} url={project.icon_url}/> : <Icon aria-hidden="true" strokeWidth={1.5}/>}</span>;
}
