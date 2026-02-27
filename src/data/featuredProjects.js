export const featuredProjects = [
  {
    id: 'project-1',
    name: 'Vortex GPGPU',
    summary: {
      en: 'Contributed on Vortex, a full-stack open-source RISC-V GPGPU with SimX, RTL simulation, and FPGA backends. Current research focus: enabling tensor-core support on RISC-V GPU architecture.',
      zh: '在 Vortex GPGPU 模拟器上进行开发。Vortex 是一个全栈开源 RISC-V GPGPU，支持 C++ SimX仿真、RTL 仿真和 FPGA 后端。当前研究重点是探索在 RISC-V GPU 上支持 tensor core。',
    },
    tech: ['C++', 'RISC-V', 'GPU', 'RTL', 'FPGA'],
    repoUrl: 'https://github.com/vortexgpgpu/vortex',
    demoUrl: '',
    featured: true,
  },
  {
    id: 'project-2',
    name: 'Find Your Clubs',
    summary: {
      en: 'A STEM-club discovery and application platform with smart search, personalized recommendations, club detail pages, favorites, and leader-side management for clubs and applications.',
      zh: '一个面向 STEM 社团的信息导航与申请平台，支持智能搜索、个性化推荐、社团详情、收藏功能，以及社团负责人端的社团与申请管理。',
    },
    tech: ['React', 'Node.js', 'MongoDB', 'Express'],
    repoUrl: 'https://github.com/EricSongXinLe/find_your_clubs',
    demoUrl: '',
    featured: true,
  },
  {
    id: 'project-3',
    name: 'Brewin Interpreter',
    summary: {
      en: 'Built a static-typed Brewin interpreter with AST-based execution, user-defined structs, coercion, nested structs, exception handling, and static scoping with optimized variable lookup.',
      zh: '实现了支持静态类型的 Brewin 解释器，包含基于 AST 的执行流程、用户自定义结构体、类型转换、嵌套结构体、异常处理以及静态作用域优化查找。',
    },
    tech: ['Python', 'AST', 'Static Typing', 'Interpreter'],
    repoUrl: 'https://github.com/EricSongXinLe/Brewin_Interpreter',
    demoUrl: '',
    featured: true,
  },
];
