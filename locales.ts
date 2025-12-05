export const translations = {
  zh: {
    appName: "哨兵导航",
    status: {
      online: "运行正常",
      offline: "无法访问",
      checking: "检测中...",
      unknown: "未知",
      never: "从未"
    },
    dashboard: {
      systemStatus: "系统状态",
      monitoringDesc: "实时监控 {count} 个服务的连通性。",
      refreshAll: "刷新所有",
      noSites: "暂无网站配置。",
      loginToAdd: "登录添加网站",
      online: "在线",
      offline: "离线",
      adminLogin: "管理员登录",
      dashboardLink: "返回仪表盘",
      footer: "哨兵导航。所有系统运行正常。",
      checkNow: "立即检测"
    },
    login: {
      title: "管理员入口",
      subtitle: "输入凭据以管理导航页",
      username: "用户名",
      password: "密码",
      securityCheck: "安全验证",
      enterCode: "输入验证码",
      submit: "登录后台",
      back: "返回导航",
      errorCaptcha: "验证码错误。",
      errorAuth: "用户名或密码错误。",
      refreshCaptcha: "点击刷新图片"
    },
    admin: {
      title: "网站管理",
      subtitle: "添加、删除或编辑受监控的网站。",
      searchPlaceholder: "搜索...",
      addNew: "新增网站",
      logout: "退出登录",
      table: {
        website: "网站",
        url: "链接",
        status: "状态",
        actions: "操作",
        empty: "未找到相关网站。",
      },
      modal: {
        addTitle: "新增网站",
        editTitle: "编辑网站",
        titleLabel: "标题",
        urlLabel: "链接地址",
        descLabel: "描述（可选）",
        placeholderTitle: "例如：我的博客",
        placeholderUrl: "example.com",
        placeholderDesc: "简短的描述...",
        cancel: "取消",
        create: "创建",
        update: "更新",
      },
      confirmDelete: "确定要删除此网站监控吗？"
    }
  },
  en: {
    appName: "SentinelNav",
    status: {
      online: "Operational",
      offline: "Unreachable",
      checking: "Checking...",
      unknown: "Unknown",
      never: "Never"
    },
    dashboard: {
      systemStatus: "System Status",
      monitoringDesc: "Real-time connectivity monitoring for {count} services.",
      refreshAll: "Refresh All",
      noSites: "No websites configured.",
      loginToAdd: "Login to add websites",
      online: "Online",
      offline: "Offline",
      adminLogin: "Admin Login",
      dashboardLink: "Dashboard",
      footer: "SentinelNav. All systems operational.",
      checkNow: "Check Status Now"
    },
    login: {
      title: "Admin Access",
      subtitle: "Enter credentials to manage navigation",
      username: "Username",
      password: "Password",
      securityCheck: "Security Check",
      enterCode: "Enter code",
      submit: "Login to Dashboard",
      back: "Back to Navigation",
      errorCaptcha: "Invalid CAPTCHA code.",
      errorAuth: "Invalid username or password.",
      refreshCaptcha: "Click to refresh image"
    },
    admin: {
      title: "Website Management",
      subtitle: "Add, remove or edit monitored websites.",
      searchPlaceholder: "Search...",
      addNew: "Add New",
      logout: "Logout",
      table: {
        website: "Website",
        url: "URL",
        status: "Status",
        actions: "Actions",
        empty: "No websites found.",
      },
      modal: {
        addTitle: "Add New Website",
        editTitle: "Edit Website",
        titleLabel: "Title",
        urlLabel: "URL",
        descLabel: "Description (Optional)",
        placeholderTitle: "e.g., My Blog",
        placeholderUrl: "example.com",
        placeholderDesc: "Short description...",
        cancel: "Cancel",
        create: "Create",
        update: "Update",
      },
      confirmDelete: "Are you sure you want to delete this website monitoring?"
    }
  }
};
