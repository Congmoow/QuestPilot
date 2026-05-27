import { describe, expect, it } from 'vitest';

import { parseTomlQuestions } from '../../../src/features/ai-import/utils/tomlImport';
import { selectTomlDropPath } from '../../../src/features/ai-import/utils/tomlFileDrop';

describe('TOML 批量导入解析', () => {
  it('解析英文 questions 数组表为题目输入', () => {
    const questions = parseTomlQuestions(`
[[questions]]
type = "single"
content = "以下哪个是基本数据类型？"
options = ["A. String", "B. Array", "C. Object"]
answer = "A"
analysis = "String 是基本数据类型"
`);

    expect(questions).toEqual([
      {
        type: 'single',
        content: '以下哪个是基本数据类型？',
        options: [
          { id: 'A', text: 'String' },
          { id: 'B', text: 'Array' },
          { id: 'C', text: 'Object' },
        ],
        answer: 'A',
        analysis: 'String 是基本数据类型',
      },
    ]);
  });

  it('解析中文字段并归一化判断题答案', () => {
    const questions = parseTomlQuestions(`
[[questions]]
题型 = "判断题"
题目 = "React 是前端框架。"
答案 = true
解析 = "React 用于构建用户界面"
`);

    expect(questions).toEqual([
      {
        type: 'boolean',
        content: 'React 是前端框架。',
        answer: '正确',
        analysis: 'React 用于构建用户界面',
      },
    ]);
  });

  it('归一化多选题答案和对象选项', () => {
    const questions = parseTomlQuestions(`
[[questions]]
type = "multiple"
content = "以下哪些是前端框架？"
answer = ["A", "B"]

[[questions.options]]
id = "A"
text = "React"

[[questions.options]]
id = "B"
text = "Vue"

[[questions.options]]
id = "C"
text = "Node.js"
`);

    expect(questions).toEqual([
      {
        type: 'multiple',
        content: '以下哪些是前端框架？',
        options: [
          { id: 'A', text: 'React' },
          { id: 'B', text: 'Vue' },
          { id: 'C', text: 'Node.js' },
        ],
        answer: 'A|B',
        analysis: '',
      },
    ]);
  });

  it('填空题答案数量与空栏数量不匹配时抛出题号错误', () => {
    expect(() =>
      parseTomlQuestions(`
[[questions]]
题型 = "填空题"
题目 = "HTML 的全称是___，CSS 的全称是___。"
答案 = "HyperText Markup Language"
`),
    ).toThrow('第 1 道填空题答案数量(1)与空栏数量(2)不匹配');
  });

  it('从拖拽路径中选择第一个 TOML 文件路径', () => {
    expect(
      selectTomlDropPath(['D:\\Desktop\\notes.txt', 'D:\\Desktop\\questions.TOML']),
    ).toBe('D:\\Desktop\\questions.TOML');
    expect(selectTomlDropPath(['D:\\Desktop\\notes.txt'])).toBeNull();
  });
});
