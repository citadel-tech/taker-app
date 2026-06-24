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

// Import each icon from its own file. Importing from the lucide barrel
// (lucide.js) pulls in ALL ~1700 icon modules over file://, which stalls
// renderer startup in the packaged app and leaves the window blank.
import Check from '../../node_modules/lucide/dist/esm/icons/check.js';
import CheckCircle from '../../node_modules/lucide/dist/esm/icons/circle-check-big.js';
import XCircle from '../../node_modules/lucide/dist/esm/icons/circle-x.js';
import AlertTriangle from '../../node_modules/lucide/dist/esm/icons/triangle-alert.js';
import RefreshCw from '../../node_modules/lucide/dist/esm/icons/refresh-cw.js';
import Loader from '../../node_modules/lucide/dist/esm/icons/loader.js';
import ArrowDownCircle from '../../node_modules/lucide/dist/esm/icons/circle-arrow-down.js';
import ArrowUpCircle from '../../node_modules/lucide/dist/esm/icons/circle-arrow-up.js';
import Package from '../../node_modules/lucide/dist/esm/icons/package.js';
import Save from '../../node_modules/lucide/dist/esm/icons/save.js';
import ExternalLink from '../../node_modules/lucide/dist/esm/icons/external-link.js';
import ArrowUpRight from '../../node_modules/lucide/dist/esm/icons/arrow-up-right.js';
import ArrowDownLeft from '../../node_modules/lucide/dist/esm/icons/arrow-down-left.js';
import Zap from '../../node_modules/lucide/dist/esm/icons/zap.js';
import Copy from '../../node_modules/lucide/dist/esm/icons/copy.js';
import Search from '../../node_modules/lucide/dist/esm/icons/search.js';
import Lock from '../../node_modules/lucide/dist/esm/icons/lock.js';
import Key from '../../node_modules/lucide/dist/esm/icons/key.js';
import KeyRound from '../../node_modules/lucide/dist/esm/icons/key-round.js';
import ClipboardCopy from '../../node_modules/lucide/dist/esm/icons/clipboard-copy.js';
import Info from '../../node_modules/lucide/dist/esm/icons/info.js';
import Timer from '../../node_modules/lucide/dist/esm/icons/timer.js';
import Link from '../../node_modules/lucide/dist/esm/icons/link.js';
import Handshake from '../../node_modules/lucide/dist/esm/icons/handshake.js';
import Receipt from '../../node_modules/lucide/dist/esm/icons/receipt.js';
import FileText from '../../node_modules/lucide/dist/esm/icons/file-text.js';
import CircleDollarSign from '../../node_modules/lucide/dist/esm/icons/circle-dollar-sign.js';
import ShieldCheck from '../../node_modules/lucide/dist/esm/icons/shield-check.js';
import Recycle from '../../node_modules/lucide/dist/esm/icons/recycle.js';
import Globe from '../../node_modules/lucide/dist/esm/icons/globe.js';
import Inbox from '../../node_modules/lucide/dist/esm/icons/inbox.js';
import Radio from '../../node_modules/lucide/dist/esm/icons/radio.js';
import Hourglass from '../../node_modules/lucide/dist/esm/icons/hourglass.js';
import FolderOpen from '../../node_modules/lucide/dist/esm/icons/folder-open.js';
import Folder from '../../node_modules/lucide/dist/esm/icons/folder.js';
import Lightbulb from '../../node_modules/lucide/dist/esm/icons/lightbulb.js';
import PlusCircle from '../../node_modules/lucide/dist/esm/icons/circle-plus.js';
import PauseCircle from '../../node_modules/lucide/dist/esm/icons/circle-pause.js';
import Eye from '../../node_modules/lucide/dist/esm/icons/eye.js';
import EyeOff from '../../node_modules/lucide/dist/esm/icons/eye-off.js';
import ArrowLeft from '../../node_modules/lucide/dist/esm/icons/arrow-left.js';

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
  /** incoming transaction */
  arrowDownLeft:  (size = 16, cls = '') => toSvg(ArrowDownLeft,  size, cls),
  /** outgoing transaction */
  arrowUpRight:   (size = 16, cls = '') => toSvg(ArrowUpRight,   size, cls),
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
  /** show password */
  eye:            (size = 16, cls = '') => toSvg(Eye,            size, cls),
  /** hide password */
  eyeOff:         (size = 16, cls = '') => toSvg(EyeOff,         size, cls),
  /** back / previous */
  arrowLeft:      (size = 16, cls = '') => toSvg(ArrowLeft,      size, cls),
};
