import { icon } from '../lib/icons';

export function Icon({ name, size = 15 }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: icon(name, size) }} />;
}
