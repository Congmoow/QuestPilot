import type {
  ButtonHTMLAttributes,
  ChangeEventHandler,
  ElementType,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
  RefObject,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type IconComponent = ElementType;
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'purple' | 'orange';

export interface PageHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader(props: PageHeaderProps): ReactElement;
export function PageHeaderNoTitle(props: Omit<PageHeaderProps, 'title'>): ReactElement;

export interface SurfaceCardProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: string;
  as?: ElementType;
}

export function SurfaceCard(props: SurfaceCardProps): ReactElement;
export function ToolbarCard(props: { children?: ReactNode; className?: string }): ReactElement;

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconComponent;
  loading?: boolean;
  className?: string;
}

export function ActionButton(props: ActionButtonProps): ReactElement;

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: IconComponent;
  variant?: ButtonVariant;
  className?: string;
  tooltip?: boolean;
}

export function IconButton(props: IconButtonProps): ReactElement;
export function StatusBadge(props: { children?: ReactNode; variant?: BadgeVariant; className?: string }): ReactElement;
export function AlertBanner(props: { type?: 'info' | 'success' | 'warning' | 'danger'; title?: ReactNode; children?: ReactNode; className?: string }): ReactElement;
export function EmptyState(props: { icon?: IconComponent; title?: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; bareIcon?: boolean }): ReactElement;
export function SegmentedTabs<T extends string = string>(props: { tabs: Array<{ id: T; label: ReactNode; icon?: IconComponent; disabled?: boolean; title?: string }>; value: T; onChange: (id: T) => void; className?: string }): ReactElement;

export interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Field(props: FieldProps): ReactElement;
export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { className?: string; error?: ReactNode | boolean }): ReactElement;
export function TextareaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string; error?: ReactNode | boolean }): ReactElement;
export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement> & { className?: string; children?: ReactNode }): ReactElement;
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { show: boolean; onToggleShow: () => void; className?: string }): ReactElement;
export function SearchInput(props: { value: string; onChange: ChangeEventHandler<HTMLInputElement>; onClear?: () => void; onEnter?: KeyboardEventHandler<HTMLInputElement>; placeholder?: string; className?: string }): ReactElement;

export function QuestionBankCard(props: { bank: { id: number; name: string; description?: string | null; createdAt: string; questionCount?: number; question_count?: number }; icon?: IconComponent; onClick?: () => void; onEdit?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']; onDelete?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']; formatDate?: (value: string) => string; toneClass?: string }): ReactElement;
export function PracticeCard(props: { bank: { id: number; name: string; questionCount?: number; question_count?: number }; icon?: IconComponent; index?: number; selected?: boolean; onSelect?: () => void; onStart?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'] }): ReactElement;
export function QuestionCard(props: { children?: ReactNode; selected?: boolean; className?: string }): ReactElement;
export function QuizShell(props: { current: number; total: number; children?: ReactNode; actions?: ReactNode; className?: string }): ReactElement;
export function AnswerOptionCard(props: { children?: ReactNode; state?: 'default' | 'selected' | 'correct' | 'wrong'; onClick?: () => void; disabled?: boolean }): ReactElement;
export function ResultSummary(props: { title: ReactNode; subtitle?: ReactNode; stats: Array<{ label: string; value: ReactNode; className?: string }>; score?: number | null; actions?: ReactNode; icon?: IconComponent }): ReactElement;
export function Pagination(props: { page: number; totalPages: number; onPageChange: (page: number) => void; className?: string }): ReactElement | null;
export function TypeBadge(props: { type: string; label: ReactNode }): ReactElement;

export function StatCard(props: { title: ReactNode; value: ReactNode; trend?: { label: ReactNode; value: ReactNode }; iconIndex?: number; tone?: string }): ReactElement;
export function ChartCard(props: { title: ReactNode; icon?: IconComponent; action?: ReactNode; children?: ReactNode; className?: string }): ReactElement;
export function TimelineLog(props: { logs?: Array<{ id?: number; action: string; detail?: string; createdAt: string }>; formatTime?: (value: string) => string; emptyText?: ReactNode; className?: string }): ReactElement;

export function JsonEditorPanel(props: { value: string; onChange: ChangeEventHandler<HTMLTextAreaElement>; placeholder?: string; title?: ReactNode; supportText?: ReactNode; className?: string }): ReactElement;
export function ParsedQuestionItem(props: { question: { content: string; answer: string }; index: number; typeLabel: ReactNode; onRemove?: () => void; removeIcon?: IconComponent }): ReactElement;
export function AIChatWelcome(props: { features?: Array<{ title: string; description: string; icon?: IconComponent; iconSrc?: string; iconClass?: string }> }): ReactElement;
export function ChatMessageBubble(props: { role: string; children?: ReactNode; avatar?: ReactNode; className?: string }): ReactElement;
export function ChatComposer(props: { value: string; onChange: ChangeEventHandler<HTMLTextAreaElement>; onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>; onSend: () => void; loading?: boolean; disabled?: boolean; inputRef?: RefObject<HTMLTextAreaElement>; placeholder?: string }): ReactElement;
export function ParseEmptyState(): ReactElement;
