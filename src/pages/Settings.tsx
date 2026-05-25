import { PageHeader } from '../components/ui';
import ApiConfigSection from '../features/settings/components/ApiConfigSection';
import MigrationSection from '../features/settings/components/MigrationSection';
import PromptsSection from '../features/settings/components/PromptsSection';
import ThresholdSection from '../features/settings/components/ThresholdSection';

const Settings = () => (
  <div className="space-y-6">
    <PageHeader title="系统设置" subtitle="配置 AI 功能与练习偏好" />
    <ThresholdSection />
    <MigrationSection />
    <ApiConfigSection />
    <PromptsSection />
    <p className="text-xs text-gray-400 dark:text-gray-500">
      说明：API Key 将安全存储在本地数据库中，不会上传到任何服务器。
    </p>
  </div>
);

export default Settings;
