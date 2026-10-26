// Run 24 step 2b: minimal black-and-white type marks for the family drive (folder / doc / image thumb / extension label).
import Icon from '../Icon.jsx';
export const extOf = (name = '') => { const m = /\.([a-z0-9]{1,5})$/i.exec(String(name)); return m ? m[1].toUpperCase() : ''; };
export default function FileIcon({ item, size = 26 }) {
  if (item.kind === 'folder') return <Icon name="folder" size={size} />;
  if (item.thumb) return <img src={item.thumb} alt="" loading="lazy" />;
  if (item.kind === 'doc') return <Icon name="edit" size={size} />;
  if (item.kind === 'image') return <Icon name="image" size={size} />;
  if (item.kind === 'video' || item.kind === 'audio') return <span className="fi-media"><Icon name="play" size={size - 6} /></span>;
  return <span className="fi-ext">{extOf(item.name) || <Icon name="file" size={size} />}</span>;
}
