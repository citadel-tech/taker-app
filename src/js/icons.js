/**
 * Icon helpers built on top of the `lucide` package.
 *
 * Usage in HTML templates:
 *   import { icons } from '../../js/icons.js';
 *   `<button>${icons.save()} Save</button>`
 *   `<button>${icons.save(20, 'mr-1')} Save</button>`
 *
 * @param {number} size  - width/height in px (default 16)
 * @param {string} cls   - extra CSS classes appended to the <svg>
 * @returns {string}     - inline SVG string ready to embed in innerHTML
 */

import {
  Check,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  Save,
  ExternalLink,
  Zap,
  Copy,
  Search,
  Lock,
  Key,
  KeyRound,
  ClipboardCopy,
  Info,
  Timer,
  Link,
  Handshake,
  Receipt,
  FileText,
  CircleDollarSign,
  ShieldCheck,
  Recycle,
  Globe,
  Inbox,
  Radio,
  Hourglass,
  FolderOpen,
  Folder,
  Lightbulb,
  PlusCircle,
  PauseCircle,
} from '../../node_modules/lucide/dist/esm/lucide.js';

function nodeToString([tag, attrs, children]) {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const childStr = children ? children.map(nodeToString).join('') : '';
  return childStr
    ? `<${tag} ${attrStr}>${childStr}</${tag}>`
    : `<${tag} ${attrStr}/>`;
}

function toSvg(iconData, size, cls) {
  const children = iconData.map(nodeToString).join('');
  const baseClass = 'inline-block align-middle flex-shrink-0';
  const classAttr = cls
    ? `class="${baseClass} ${cls}"`
    : `class="${baseClass}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${classAttr}>${children}</svg>`;
}

export const icons = {
  /** ✅ success / completed */
  checkCircle:    (size = 16, cls = '') => toSvg(CheckCircle,    size, cls),
  /** ✓ bare check (compact) */
  check:          (size = 16, cls = '') => toSvg(Check,          size, cls),
  /** ❌ error / failure */
  xCircle:        (size = 16, cls = '') => toSvg(XCircle,        size, cls),
  /** ⚠️ warning */
  alertTriangle:  (size = 16, cls = '') => toSvg(AlertTriangle,  size, cls),
  /** 🔄 refresh / sync / coinswap */
  refreshCw:      (size = 16, cls = '') => toSvg(RefreshCw,      size, cls),
  /** ⟳ loading spinner — add animate-spin class */
  loader:         (size = 16, cls = '') => toSvg(Loader,         size, cls),
  /** 📥 receive / incoming */
  arrowDownCircle:(size = 16, cls = '') => toSvg(ArrowDownCircle,size, cls),
  /** 📤 send / outgoing */
  arrowUpCircle:  (size = 16, cls = '') => toSvg(ArrowUpCircle,  size, cls),
  /** 📦 UTXO / package */
  package:        (size = 16, cls = '') => toSvg(Package,        size, cls),
  /** 💾 save / backup */
  save:           (size = 16, cls = '') => toSvg(Save,           size, cls),
  /** 🔍 mempool explorer / external link */
  externalLink:   (size = 16, cls = '') => toSvg(ExternalLink,   size, cls),
  /** ⚡ speed / zap */
  zap:            (size = 16, cls = '') => toSvg(Zap,            size, cls),
  /** copy to clipboard */
  copy:           (size = 16, cls = '') => toSvg(Copy,           size, cls),
  /** search */
  search:         (size = 16, cls = '') => toSvg(Search,         size, cls),
  /** 🔒 lock / privacy */
  lock:           (size = 16, cls = '') => toSvg(Lock,           size, cls),
  /** 🔑 key / signing */
  key:            (size = 16, cls = '') => toSvg(Key,            size, cls),
  /** 🔐 key round / key exchange */
  keyRound:       (size = 16, cls = '') => toSvg(KeyRound,       size, cls),
  /** 📋 clipboard copy */
  clipboardCopy:  (size = 16, cls = '') => toSvg(ClipboardCopy,  size, cls),
  /** ℹ️ info */
  info:           (size = 16, cls = '') => toSvg(Info,           size, cls),
  /** ⏱️ timer / duration */
  timer:          (size = 16, cls = '') => toSvg(Timer,          size, cls),
  /** 🔗 link / artifacts */
  link:           (size = 16, cls = '') => toSvg(Link,           size, cls),
  /** 🤝 handshake / swap partners */
  handshake:      (size = 16, cls = '') => toSvg(Handshake,      size, cls),
  /** 💸 receipt / fees */
  receipt:        (size = 16, cls = '') => toSvg(Receipt,        size, cls),
  /** 📝 file text / transactions */
  fileText:       (size = 16, cls = '') => toSvg(FileText,       size, cls),
  /** 💰 dollar / amount */
  circleDollarSign:(size = 16, cls = '') => toSvg(CircleDollarSign, size, cls),
  /** 🛡️ shield check / privacy contribution */
  shieldCheck:    (size = 16, cls = '') => toSvg(ShieldCheck,    size, cls),
  /** ♻️ recycle / restore wallet */
  recycle:        (size = 16, cls = '') => toSvg(Recycle,        size, cls),
  /** 🧅 Tor / network / globe */
  globe:          (size = 16, cls = '') => toSvg(Globe,          size, cls),
  /** 📭 empty inbox */
  inbox:          (size = 16, cls = '') => toSvg(Inbox,          size, cls),
  /** 📡 broadcast / radio */
  radio:          (size = 16, cls = '') => toSvg(Radio,          size, cls),
  /** ⏳ hourglass / pending */
  hourglass:      (size = 16, cls = '') => toSvg(Hourglass,      size, cls),
  /** 📂 folder open */
  folderOpen:     (size = 16, cls = '') => toSvg(FolderOpen,     size, cls),
  /** 📁 folder */
  folder:         (size = 16, cls = '') => toSvg(Folder,         size, cls),
  /** 💡 tip / lightbulb */
  lightbulb:      (size = 16, cls = '') => toSvg(Lightbulb,      size, cls),
  /** 🆕 create new */
  plusCircle:     (size = 16, cls = '') => toSvg(PlusCircle,     size, cls),
  /** ⏸️ unresponsive / paused */
  pauseCircle:    (size = 16, cls = '') => toSvg(PauseCircle,    size, cls),
};
