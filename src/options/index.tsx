import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import { registerAllProviders } from '@/providers';
import './options.css';

// Register providers before rendering
registerAllProviders();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
