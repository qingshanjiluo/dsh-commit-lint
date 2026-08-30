import React from 'react';
import { createSettingsCard } from '@deepseek-ai/dsh-settings';

export default createSettingsCard({
  title: 'commit-lint',
  description: '提交消息检查',
  config: [
    { key: 'enabled', type: 'boolean', label: '启用插件', default: true },
  ],
});
