import type { AdminFormState, DiskFormState, TabOption } from "./types";

export const storageKey = "diskhub-auth-session";

export const uiText = {
  common: {
    brandName: "diskHub",
    brandTagline: "Платформа управления хранилищем",
    waiting: "Ожидание данных",
    syncing: "Обновление",
    closeMenu: "Открыть меню",
    cancel: "Отмена",
    close: "Закрыть",
    delete: "Удалить",
    deleting: "Удаление...",
    saving: "Сохранение..."
  },
  topbar: {
    accessOpen: "Доступ открыт",
    goToDisks: "К дискам"
  },
  tabs: {
    overview: "Обзор",
    disks: "Диски"
  },
  auth: {
    loadingTitle: "Проверяем сессию",
    loadingText: "Подождите немного, загружаем данные пользователя.",
    heroEyebrow: "Вход в систему",
    heroTitle: "Войдите в diskHub",
    heroText: "Авторизуйтесь, чтобы получить доступ к управлению дисками и мониторингу.",
    cardTitle: "Вход в diskHub",
    realmLabel: "Контур",
    realmName: "diskhub",
    username: "Логин",
    password: "Пароль",
    submit: "Войти",
    submitting: "Вход..."
  },
  sidebar: {
    back: "Назад",
    profileMenu: "Меню профиля",
    admin: "Администрирование",
    logout: "Выйти",
    adminSections: {
      disks: "Диски",
      users: "Пользователи",
      monitoring: "Мониторинг"
    }
  },
  overview: {
    boardEyebrow: "Состояние платформы",
    boardTitle: "Нагрузка на подключённые iSCSI-диски",
    boardSubtitle: "Показатели отражают активность по томам, выданным пользователям и доступным для работы.",
    metrics: {
      activeDisks: {
        label: "Активные диски",
        meta: "Количество томов, доступных пользователям в текущий момент."
      },
      issuedThroughput: {
        label: "Пропускная способность",
        meta: "Суммарная скорость чтения и записи по активным томам."
      },
      issuedBusy: {
        label: "Пиковая загрузка",
        meta: "Максимальная оценка загрузки по активным томам."
      },
      iops: {
        label: "IOPS",
        meta: "Суммарное количество операций ввода-вывода в секунду."
      }
    },
    charts: {
      throughput: "Пропускная способность",
      iops: "IOPS",
      busy: "Загрузка",
      historySuffix: "точек мониторинга за последнее время.",
      waitingHistory: "Недостаточно данных для построения графика."
    },
    profile: {
      eyebrow: "Профиль доступа",
      title: "Текущий профиль",
      subtitle: "Краткая информация об учётной записи и её текущей нагрузке на систему хранения.",
      adminAccess: "Доступ администратора",
      userAccess: "Пользовательский доступ",
      userLabel: "Пользователь",
      loadLabel: "Нагрузка",
      loadMeta: "Оценочная доля I/O по дискам пользователя на основе последних данных мониторинга.",
      quickStats: {
        volumes: { label: "Томов", meta: "Количество активных дисков в вашей зоне ответственности." },
        capacity: { label: "Объём", meta: "Суммарный объём выделенного пространства." },
        userIops: { label: "Пользовательские IOPS", meta: "Оценочная интенсивность операций ввода-вывода." },
        userBusy: { label: "Загрузка пользователя", meta: "Оценочная доля использования ресурсов хранилища." }
      }
    },
    topVolumes: {
      eyebrow: "Тома",
      title: "Наиболее нагруженные тома",
      subtitle: "Тома с наибольшей оценочной I/O-нагрузкой среди подключённых iSCSI-дисков.",
      openDisksTitle: "Диски",
      openDisksText: "Перейти к списку дисков и открыть параметры подключения."
    },
    breakdown: {
      eyebrow: "Аналитика нагрузки",
      adminTitle: "Пользователи и устройства",
      userTitle: "Мои диски",
      adminSubtitle: "Сводка по самым загруженным пользователям и физическим устройствам.",
      userSubtitle: "Список ваших дисков с оценкой текущей I/O-нагрузки.",
      feedStatus: "Данные актуальны",
      adminListTitle: "Пользователи с наибольшей нагрузкой",
      userListTitle: "Диски пользователя",
      issuedPool: "Рабочий пул",
      productionSlice: "Активный iSCSI-сегмент"
    }
  },
  disks: {
    title: "Ваши диски",
    subtitle: "Управление выделенными блочными устройствами",
    create: "Создать диск",
    statusComplete: "Операция завершена",
    statusInProgress: "Операция выполняется",
    statusIdle: "Ожидание действий",
    stats: {
      total: "Всего",
      pending: "В работе",
      capacity: "Общий объём"
    },
    hint: "Откройте диск, чтобы просмотреть параметры подключения и состояние доступа.",
    table: {
      name: "Имя",
      size: "Размер",
      owner: "Владелец",
      status: "Статус",
      updated: "Обновлено",
      actions: "Действия"
    },
    emptyLoading: "Загружаем список дисков...",
    empty: "У вас пока нет созданных дисков."
  },
  adminDisks: {
    eyebrow: "Администрирование",
    title: "Все диски",
    stats: {
      total: "Все диски",
      capacity: "Общий объём",
      owners: "Владельцы"
    },
    emptyLoading: "Загружаем диски...",
    empty: "Диски не найдены.",
    transferOwner: "Сменить владельца"
  },
  adminUsers: {
    eyebrow: "Администрирование",
    title: "Пользователи",
    create: "Создать пользователя",
    stats: {
      total: "Пользователи",
      active: "Активные",
      admins: "Администраторы"
    },
    table: {
      user: "Пользователь",
      email: "Электронная почта",
      status: "Статус",
      groups: "Группы",
      actions: "Действия"
    },
    emptyLoading: "Загружаем пользователей...",
    empty: "Пользователи пока не найдены.",
    noEmail: "Не указан",
    active: "Активен",
    disabled: "Отключён",
    adminBadge: "Администратор",
    noGroups: "Нет",
    edit: "Изменить"
  },
  adminMonitoring: {
    eyebrow: "Администрирование",
    title: "Мониторинг",
    subtitle: "Метрики физических дисков и хоста доступны в отдельном административном разделе.",
    cards: {
      throughput: { label: "Пропускная способность хоста", meta: "Суммарная скорость чтения и записи по физическим устройствам." },
      iops: { label: "IOPS хоста", meta: "Суммарное количество операций ввода-вывода по системе." },
      busy: { label: "Пиковая загрузка", meta: "Максимальная загрузка среди физических дисков." },
      devices: { label: "Устройства", meta: "Количество активных блочных устройств в текущем снимке." }
    },
    charts: {
      throughput: "Пропускная способность устройств",
      iops: "IOPS устройств",
      busy: "Загрузка устройств",
      historyMeta: "История физических метрик по последним точкам мониторинга."
    },
    table: {
      device: "Устройство",
      throughput: "Пропускная способность",
      iops: "IOPS",
      busy: "Загрузка",
      inflight: "Активные операции",
      deviceMeta: "Физическое блочное устройство"
    },
    emptyLoading: "Загружаем метрики устройств...",
    empty: "Данные по физическим дискам пока недоступны."
  },
  modals: {
    createDisk: {
      eyebrow: "Создание ресурса",
      title: "Создание диска",
      closeLabel: "Закрыть окно создания диска",
      introLabel: "Новый том",
      introText: "Укажите параметры тома. После создания диск появится в списке и будет доступен для подключения.",
      chips: ["Инвентаризация", "Подготовка", "Публикация iSCSI"],
      paramsLabel: "Параметры",
      paramsText: "Основные параметры диска для создания и публикации в системе хранения.",
      templateVolume: "Шаблонный том",
      name: "Название диска",
      size: "Размер, ГБ",
      filesystem: "Файловая система",
      performanceTier: "Класс производительности",
      submit: "Создать диск",
      submitting: "Создание..."
    },
    iscsi: {
      eyebrow: "Параметры подключения",
      title: "Подключение по iSCSI",
      closeLabel: "Закрыть окно параметров подключения",
      introLabel: "Подключение",
      introText: "Данные для подключения, обнаружения цели и монтирования выбранного диска.",
      ready: "Готово",
      noTarget: "Цель недоступна",
      portal: "Портал",
      iqn: "IQN",
      lun: "LUN",
      auth: "Аутентификация",
      steps: {
        discovery: "1. Обнаружение",
        login: "2. Подключение",
        device: "3. Устройство",
        mount: "4. Монтирование"
      },
      pendingTarget: "Для этого диска цель iSCSI ещё не подготовлена. Дождитесь статуса ",
      readyPair: "ready / ready",
      pendingTargetSuffix: " после завершения обработки.",
      empty: "Выберите диск в списке, чтобы открыть параметры подключения по iSCSI."
    },
    adminUser: {
      editEyebrow: "Редактирование доступа",
      newEyebrow: "Новый пользователь",
      editTitle: "Редактирование пользователя",
      createTitle: "Создание пользователя",
      closeLabel: "Закрыть окно пользователя",
      editMode: "Режим редактирования",
      newMode: "Новый пользователь",
      editText: "Обновите профиль, доступ или пароль. Пустой пароль оставит текущий без изменений.",
      createText: "Заполните базовые данные и сразу задайте уровень доступа для новой учётной записи.",
      editChip: "Изменение профиля",
      createChip: "Создание профиля",
      active: "Активен",
      disabled: "Отключён",
      profileSection: "Профиль",
      username: "Логин",
      usernamePlaceholder: "Например, a.smirnov",
      required: "Обязательно",
      email: "Электронная почта",
      emailPlaceholder: "user@diskhub.local",
      firstName: "Имя",
      firstNamePlaceholder: "Алексей",
      lastName: "Фамилия",
      lastNamePlaceholder: "Смирнов",
      accessSection: "Доступ",
      enableUser: "Активировать пользователя",
      enableUserHint: "Разрешает авторизацию и работу с системой.",
      adminRole: "Администратор",
      adminRoleHint: "Даёт доступ к управлению пользователями и расширенным разделам.",
      newPassword: "Новый пароль",
      password: "Пароль",
      editPasswordPlaceholder: "Оставьте пустым, чтобы не менять",
      createPasswordPlaceholder: "Минимум для первого входа",
      editPasswordHint: "Заполняйте только если нужно сбросить пароль.",
      createPasswordHint: "Обязателен только для новой учётной записи.",
      preview: "Предпросмотр",
      newUserFallback: "Новый пользователь",
      emailMissing: "Электронная почта не указана",
      editState: "Редактирование",
      createState: "Создание",
      reset: "Сбросить",
      save: "Сохранить изменения",
      create: "Создать пользователя"
    },
    deleteDisk: {
      eyebrow: "Подтверждение",
      title: "Удаление диска",
      closeLabel: "Закрыть окно подтверждения удаления",
      question: "Подтвердите удаление",
      textBeforeId: "Диск ",
      textAfterId: " будет поставлен в очередь на удаление."
    }
  },
  messages: {
    sessionExpired: "Срок действия сессии истёк.",
    loginRequired: "Сначала войдите",
    sessionInvalid: "Сессия больше недействительна. Войдите снова.",
    loginFailed: "Не удалось выполнить вход через Keycloak.",
    loginProfileFailed: "Не удалось загрузить профиль пользователя.",
    loginError: "Ошибка входа",
    diskSizeInvalid: "Размер диска должен быть положительным числом",
    diskCreateFailed: "Не удалось создать диск.",
    diskCreated: "Диск создан",
    diskCreateError: "Ошибка создания диска",
    disksListFailed: "Не удалось загрузить список дисков.",
    disksLoadError: "Не удалось загрузить диски.",
    monitoringLoadFailed: "Не удалось загрузить данные мониторинга.",
    adminMonitoringForbidden: "Недостаточно прав для просмотра мониторинга.",
    adminMonitoringLoadFailed: "Не удалось загрузить административные данные мониторинга.",
    diskDeleteForbidden: "Можно удалять только диски, созданные от имени текущего пользователя.",
    diskNotFound: "Диск не найден или уже удалён.",
    diskDeleteConflict: "Удаление этого диска уже выполнено или недоступно.",
    diskDeleteFailed: "Не удалось удалить диск.",
    diskDeleted: "Диск удалён",
    diskDeleteError: "Ошибка удаления диска",
    adminUsersForbidden: "Недостаточно прав для доступа к админ-панели.",
    adminUsersLoadFailed: "Не удалось загрузить пользователей.",
    adminUsersLoadError: "Не удалось загрузить пользователей.",
    adminDisksForbidden: "Недостаточно прав для просмотра дисков.",
    adminDisksLoadFailed: "Не удалось загрузить список всех дисков.",
    adminDisksLoadError: "Не удалось загрузить список всех дисков.",
    adminDiskDeleteForbidden: "Недостаточно прав для удаления диска.",
    ownerRequired: "Выберите владельца",
    ownerUnchanged: "Владелец не изменился",
    userNotFound: "Пользователь не найден",
    ownerChangeForbidden: "Недостаточно прав для изменения владельца.",
    ownerChangeFailed: "Не удалось изменить владельца.",
    ownerChanged: "Владелец изменён",
    ownerChangeError: "Ошибка смены владельца",
    usernameRequired: "Логин обязателен.",
    newUserPasswordRequired: "Для нового пользователя нужен пароль.",
    adminUsersChangeForbidden: "Недостаточно прав для изменения пользователей.",
    adminUserUpdateFailed: "Не удалось обновить пользователя.",
    adminUserCreateFailed: "Не удалось создать пользователя.",
    adminUserUpdated: "Пользователь обновлён",
    adminUserCreated: "Пользователь создан",
    adminUserSaveError: "Не удалось сохранить пользователя",
    adminUserDeleteForbidden: "Недостаточно прав для удаления пользователя.",
    adminUserDeleteFailed: "Не удалось удалить пользователя.",
    adminUserDeleted: "Пользователь удалён",
    adminUserDeleteError: "Не удалось удалить пользователя",
    profileLoaded: "Профиль загружен",
    unknownUser: "Неизвестный пользователь"
  }
} as const;

export const baseTabs: TabOption[] = [
  { id: "overview", label: uiText.tabs.overview },
  { id: "disks", label: uiText.tabs.disks }
];

export const initialDiskForm: DiskFormState = {
  name: "team-volume",
  sizeGb: "120",
  filesystem: "xfs",
  performanceTier: "standard"
};

export const initialAdminForm: AdminFormState = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  enabled: true,
  isAdmin: false
};
