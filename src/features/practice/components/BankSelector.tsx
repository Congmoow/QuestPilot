import type { MouseEvent } from 'react';
import { AlertCircle, BrainCircuit, Code2, FileQuestion, Image } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ActionButton,
  EmptyState,
  PageHeader,
  PracticeCard,
  SurfaceCard,
} from '../../../components/ui';
import type { QuestionBank } from '../../../api';

const bankIcons = [Image, Code2, FileQuestion, BrainCircuit];

type BankSelectorProps = {
  banks: QuestionBank[];
  selectedBankId: number | null;
  loading: boolean;
  onSelect: (bankId: number) => void;
  onStart: (bankId: number) => void;
};

const BankSelector = ({
  banks,
  selectedBankId,
  loading: _loading,
  onSelect,
  onStart,
}: BankSelectorProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader title="随机练题" subtitle="选择题库开始随机练习" />

      {banks.length === 0 ? (
        <SurfaceCard padding="p-8">
          <EmptyState
            icon={AlertCircle}
            title="暂无题库"
            description="请先创建题库并添加题目，然后回来开始随机练习。"
            action={
              <ActionButton onClick={() => navigate('/question-preview')}>
                前往题库管理
              </ActionButton>
            }
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank, index) => (
            <motion.div
              key={bank.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <PracticeCard
                bank={bank}
                icon={bankIcons[index % bankIcons.length]}
                index={index}
                selected={selectedBankId === bank.id}
                onSelect={() => onSelect(bank.id)}
                onStart={(e: MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onStart(bank.id);
                }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BankSelector;
