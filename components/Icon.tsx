// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 — 공통 아이콘 컴포넌트 (Lucide React Native)
// 이모지 아이콘 대신 이 컴포넌트만 사용할 것
// ═══════════════════════════════════════════════════════════════
import {
  Home, BookOpen, Trophy, Target, User,
  ChevronRight, ChevronLeft, Check, X,
  Star, Flame, BookMarked, PenLine,
  MessageCircle, Brain, Lock, Unlock,
  Bell, BarChart2, Settings, LogOut,
  Search, Filter, Plus, Trash2,
  Send, FileText, Users, Award,
  Clock, Calendar, Zap, TrendingUp,
  AlertCircle, Info, RefreshCw, Download,
  Volume2, Mic, Play, Pause,
  ArrowRight, ArrowLeft, MoreHorizontal,
  GraduationCap, Layers, Grid, List,
  CheckCircle, Circle, Minus,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';

export type IconName =
  | 'home' | 'book-open' | 'trophy' | 'target' | 'user'
  | 'chevron-right' | 'chevron-left' | 'check' | 'x'
  | 'star' | 'flame' | 'book-marked' | 'pen-line'
  | 'message-circle' | 'brain' | 'lock' | 'unlock'
  | 'bell' | 'bar-chart' | 'settings' | 'log-out'
  | 'search' | 'filter' | 'plus' | 'trash'
  | 'send' | 'file-text' | 'users' | 'award'
  | 'clock' | 'calendar' | 'zap' | 'trending-up'
  | 'alert-circle' | 'info' | 'refresh' | 'download'
  | 'volume' | 'mic' | 'play' | 'pause'
  | 'arrow-right' | 'arrow-left' | 'more'
  | 'graduation' | 'layers' | 'grid' | 'list'
  | 'check-circle' | 'circle' | 'minus';

const ICON_MAP: Record<IconName, any> = {
  'home':          Home,
  'book-open':     BookOpen,
  'trophy':        Trophy,
  'target':        Target,
  'user':          User,
  'chevron-right': ChevronRight,
  'chevron-left':  ChevronLeft,
  'check':         Check,
  'x':             X,
  'star':          Star,
  'flame':         Flame,
  'book-marked':   BookMarked,
  'pen-line':      PenLine,
  'message-circle':MessageCircle,
  'brain':         Brain,
  'lock':          Lock,
  'unlock':        Unlock,
  'bell':          Bell,
  'bar-chart':     BarChart2,
  'settings':      Settings,
  'log-out':       LogOut,
  'search':        Search,
  'filter':        Filter,
  'plus':          Plus,
  'trash':         Trash2,
  'send':          Send,
  'file-text':     FileText,
  'users':         Users,
  'award':         Award,
  'clock':         Clock,
  'calendar':      Calendar,
  'zap':           Zap,
  'trending-up':   TrendingUp,
  'alert-circle':  AlertCircle,
  'info':          Info,
  'refresh':       RefreshCw,
  'download':      Download,
  'volume':        Volume2,
  'mic':           Mic,
  'play':          Play,
  'pause':         Pause,
  'arrow-right':   ArrowRight,
  'arrow-left':    ArrowLeft,
  'more':          MoreHorizontal,
  'graduation':    GraduationCap,
  'layers':        Layers,
  'grid':          Grid,
  'list':          List,
  'check-circle':  CheckCircle,
  'circle':        Circle,
  'minus':         Minus,
};

interface IconProps {
  name:       IconName;
  size?:      number;
  color?:     string;
  strokeWidth?: number;
}

export function Icon({ name, size=20, color=Colors.ink, strokeWidth=1.8 }: IconProps) {
  const Component = ICON_MAP[name];
  if (!Component) return null;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}

export default Icon;
