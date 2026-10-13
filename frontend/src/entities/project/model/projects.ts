export type Project = {
  id: string;
  name: string;
  category: string;
  summary: string;
  statement: string;
  description: string;
  keywords: string[];
  // Add real screenshots and verified public links here when available.
  screenshots?: { src: string; alt: string }[];
  url?: string;
};

export const projects: Project[] = [
  {
    id: 'couploc', name: 'Couploc', category: '移动应用 · 陪伴',
    summary: '为异地恋做的定位与沟通 App。',
    statement: '距离很远，彼此很近。',
    description: '把异地恋中的定位与沟通需求，变成一个自己制作的小应用。它是我借助 AI 探索个人生活需求的作品之一。',
    keywords: ['异地恋', '定位', '沟通'],
  },
  {
    id: 'soundtag', name: 'SoundTag', category: '移动应用 · 声音',
    summary: '探索 NFC 与音频读写的连接。',
    statement: '让声音，有一个触点。',
    description: '围绕 NFC 音频读写制作的 App。音乐是我的生活支点之一，这个小项目也承载着我对声音与工具的好奇。',
    keywords: ['NFC', '音频', '读写'],
  },
  {
    id: 'cooking', name: 'Cooking', category: '移动应用 · 日常',
    summary: '一个给日常生活提供菜品灵感的 App。',
    statement: '今天，吃点什么？',
    description: '围绕每日菜品推荐制作的应用。从每天都会遇到的小问题出发，让自己做的工具参与生活。',
    keywords: ['每日推荐', '菜品', '生活'],
  },
  {
    id: 'impromptu', name: 'Impromptu', category: '网站 · 学习',
    summary: '为口语练习而做的网站。',
    statement: '从开口的那一刻开始。',
    description: '把口语练习的想法做成一个网站。它是我用 AI 工具探索学习场景的一次实践。',
    keywords: ['口语', '练习', '表达'],
  },
  {
    id: 'shopify', name: 'Shopify 独立站插件', category: '插件 · 电商',
    summary: '围绕独立站场景的一次工具探索。',
    statement: '小工具，也有用武之地。',
    description: '在 Shopify 独立站场景下尝试制作插件。和其他作品一样，这是我借助 AI 将好奇落到实际项目中的探索。',
    keywords: ['Shopify', '独立站', '插件'],
  },
];
