import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// 导出语言感知的 Next.js 导航 hooks
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
