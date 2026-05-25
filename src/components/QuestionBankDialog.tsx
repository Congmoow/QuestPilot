import React, { useState, useEffect, type FormEvent } from 'react';
import Dialog from './Dialog';
import { ActionButton, AlertBanner, Field, TextareaInput, TextInput } from './ui';
import type { CreateQuestionBankInput, QuestionBank } from '../api';

/**
 * 题库表单对话框组件
 * 用于新建和编辑题库
 * @param {Object} props
 * @param {boolean} props.open - 是否显示对话框
 * @param {() => void} props.onClose - 关闭回调
 * @param {(data: {name: string, description: string}) => Promise<void>} props.onSubmit - 提交回调
 * @param {{id?: number, name?: string, description?: string}} [props.initialData] - 初始数据（编辑模式）
 * @param {boolean} [props.loading] - 加载状态
 */
type QuestionBankDialogErrors = {
  name?: string;
  submit?: string;
};

type QuestionBankDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateQuestionBankInput) => Promise<void>;
  initialData?: Partial<Pick<QuestionBank, 'id' | 'name' | 'description'>> | null;
  loading?: boolean;
};

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export function QuestionBankDialog({ open, onClose, onSubmit, initialData, loading = false }: QuestionBankDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<QuestionBankDialogErrors>({});

  const isEditMode = !!initialData?.id;

  // 初始化表单数据
  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name || '');
        setDescription(initialData.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setErrors({});
    }
  }, [open, initialData]);

  // 验证表单
  const validate = () => {
    const newErrors: QuestionBankDialogErrors = {};

    // 验证名称非空
    if (!name || name.trim() === '') {
      newErrors.name = '题库名称不能为空';
    } else if (name.length > 50) {
      newErrors.name = '题库名称长度不能超过50字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setErrors({ submit: errorMessage(err, '操作失败') });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditMode ? '编辑题库' : '新建题库'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="题库名称"
          required
          error={errors.name}
          hint={`${name.length}/50`}
        >
          <TextInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入题库名称"
            maxLength={50}
            error={errors.name}
          />
        </Field>

        <Field label="题库描述">
          <TextareaInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入题库描述（可选）"
            rows={3}
          />
        </Field>

        {errors.submit && (
          <AlertBanner type="danger">{errors.submit}</AlertBanner>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <ActionButton type="button" variant="secondary" onClick={onClose} disabled={loading}>
            取消
          </ActionButton>
          <ActionButton type="submit" disabled={loading} loading={loading}>
            {isEditMode ? '保存' : '创建'}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  );
}

export default QuestionBankDialog;
