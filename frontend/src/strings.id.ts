/** Bahasa Indonesia UI copy — the default locale. Components read this via `useStrings()`, never import it directly. */
export const id = {
  appName: "Patungan",
  nav: {
    landing: "Beranda",
    campaigns: "Kampanye",
    seasons: "Musim",
    results: "Hasil",
    dashboard: "Dasbor",
    account: "Akun",
    operator: "Operator",
    openMenu: "Buka menu",
    closeMenu: "Tutup menu",
    mainMenu: "Menu utama",
  },
  landing: {
    heroTitle: "Donasi kecil. Dampak lebih besar.",
    heroTags: ["Aplikasi pembayaran & konsumen", "Diaspora PMI/TKI", "Pencocokan kuadratik"],
    heroLede:
      "Dukung kampanye mulai Rp10 ribu. Semakin banyak orang ikut mendukung, semakin besar peluang kampanye menerima dana pendamping dari sponsor.",
    heroPoolLabel: "Dana pendamping",
    heroDonorLabel: "Pendukung",
    heroStatusLabel: "Status",
    waitingPool: "Menunggu",
    primaryCta: "Lihat proyek",
    secondaryCta: "Lihat hasil",
    liveProjectBadge: "Proyek live",
    waitingProjectTitle: "Menunggu data proyek",
    heroTopLine: (n: number) => `${n} pendukung menarik dana pendamping terbesar.`,
    heroTopLineEmpty: "Hubungkan deployment untuk melihat data live.",
    matchEngineLabel: "Mesin pencocokan",
    matchEngineTitle: "Finalisasi Soroban",
    crowdShareLabel: "Porsi teratas",
    selectedShareLabel: "Porsi kampanye",
    switchCampaignLabel: "Pilih kampanye untuk ditampilkan",
    rankedByDirect: "Diurutkan dari donasi musim ini",
    ofPoolSuffix: "dari dana pendamping",
    proofTag: "Lapisan bukti Soroban",
    proofBody:
      "Bumbu blockchain-nya bukan tempelan: contract menyaksikan kontribusi, registry membatasi sybil, dan payout keluar dari math yang bisa diaudit.",
    proofComment: "jalur satu musim pencocokan",
    proofSteps: [
      {
        title: "Escrow dana pendamping",
        copy: "Sponsor deposit ke contract, bukan ke rekening panitia.",
      },
      {
        title: "Satu identitas, satu suara",
        copy: "Registri terverifikasi membatasi sybil: satu identitas, satu suara.",
      },
      {
        title: "Donasi tertanda",
        copy: "Setiap urunan tercatat dengan donor, project_id, amount, dan ledger.",
      },
      {
        title: "Alokasi kuadratik",
        copy: "Contract menghitung (Σ√c)² per kampanye dan membagi dana pendamping — yang menang jumlah orang, bukan satu whale.",
      },
    ],
    directoryComment: "direktori publik — semua kampanye terverifikasi kurator",
    seasonRef: (id: string | number) => `musim #${id}`,
    title: "Patungan",
    subtitle: "Urunan bersama, dicocokkan secara adil.",
    poolLabel: "Dana pendamping",
    sponsorLabel: "Disponsori oleh",
    sponsorName: "Pemprov Jawa Timur",
    statusOpen: "Dibuka",
    statusFinalized: "Selesai",
    roundEndLabel: "Berakhir",
    notInitialized: "Round belum dibuka",
    waitingSponsor: "Menunggu sponsor",
    donorCountSuffix: "pendukung",
    projectedMatchLabel: "Proyeksi pencocokan",
    finalMatchLabel: "Pencocokan final",
    noMatchYet: "—",
  },
  /** Bahasa labels for the on-chain `Category` enum tags. Reused on every campaign surface. */
  categories: {
    DevelopingRegions: "Daerah Berkembang",
    DisasterRelief: "Tanggap Bencana",
    Education: "Pendidikan",
    Health: "Kesehatan",
    FaithCommunity: "Keagamaan & Sosial",
    EnvironmentAnimals: "Lingkungan & Satwa",
  } as Record<string, string>,
  /** Discovery `/` — the public directory over live chain state. */
  discovery: {
    heading: "Jelajahi kampanye",
    tagline: "Dukungan kecil dari banyak orang, dilipatgandakan secara adil.",
    searchPlaceholder: "Cari kampanye…",
    searchLabel: "Cari kampanye berdasarkan judul atau cerita",
    sortLabel: "Urutkan",
    sort: {
      mostBacked: "Paling didukung",
      newest: "Terbaru",
      closingSoon: "Segera berakhir",
    },
    allFilter: "Semua",
    createCta: "Ajukan kampanye",
    resultCount: (n: number) => `${n} kampanye`,
    emptyApproved: "Belum ada kampanye yang disetujui.",
    emptyFiltered: "Tidak ada kampanye yang cocok dengan filter ini.",
    resetFilters: "Atur ulang filter",
    // Season / round banner
    season: "Musim Pencocokan",
    live: "Berlangsung",
    scopeAll: "Semua kategori",
    scopeLabel: "Kategori dalam musim",
    endsInLabel: "Berakhir dalam",
    endedLabel: "Musim berakhir",
    noRound: "Belum ada musim pencocokan aktif",
    noRoundHint: "Donasi langsung tetap dibuka. Musim berikutnya segera hadir.",
    countdown: { day: " hari", hour: " jam", min: " mnt", ended: "Berakhir" },
    // Card
    donorSuffix: "pendukung",
    donorLabel: "Pendukung",
    directShort: "Langsung",
    projectedShort: "Proyeksi",
    projectedHint: "Estimasi yang dapat berubah sampai musim pencocokan difinalisasi.",
    totalShort: "Total",
    matchSuffix: "pendamping",
    cardDirectOpen: "Donasi langsung tetap dibuka",
    targetProgress: "menuju target",
    targetReached: "Target tercapai",
    noThumbAlt: "Tanpa gambar",
    // Onboarding "how it works" strip — QF explainer for cold visitors
    howItWorks: {
      overline: "Cara kerjanya",
      steps: [
        {
          n: "01",
          title: "Donasi langsung, kapan saja",
          body: "Pilih kampanye yang kamu percaya, lalu beri donasi langsung — tanpa menunggu musim.",
        },
        {
          n: "02",
          title: "Jumlah orang, bukan besar donasi",
          body: "Banyak donatur kecil memberi sinyal lebih kuat daripada satu donatur besar.",
        },
        {
          n: "03",
          title: "Dana pendamping dibagi tiap musim",
          body: "Di akhir tiap musim, dana sponsor dibagikan mengikuti sinyal itu secara kuadratik.",
        },
      ],
      viz: {
        crowd: "banyak donatur kecil",
        whale: "satu donatur besar",
        beats: "lebih kuat dari",
        sr: "Banyak donatur kecil lebih kuat daripada satu donatur besar.",
      },
    },
  },
  /** Campaign detail `/campaign/[id]` — story, ledger sidebar, inline contribute panel. */
  campaign: {
    back: "Kembali ke jelajah",
    notFoundTitle: "Kampanye tidak ditemukan",
    notFoundBody: "Kampanye ini mungkin belum ada, atau tautannya keliru.",
    backHome: "Kembali ke beranda",
    byOwner: "Dikelola oleh",
    organizer: {
      heading: "Pengelola",
      viewWallet: "Lihat wallet",
      firstCampaign: "Kampanye pertama di Patungan",
      campaignCount: (n: number) => `${n} kampanye di Patungan`,
      raisedAcross: "terkumpul dari semuanya",
      otherHeading: "Kampanye lain oleh pengelola ini",
      verifiedDomain: "Domain terverifikasi",
      curatorNote: "Setiap kampanye yang tampil sudah disetujui kurator sebelum bisa menerima donasi.",
    },
    transparencyHeading: "Transparansi pencairan",
    verifiedLabel: "Status kampanye",
    verifiedValue: "Terverifikasi kurator",
    payoutRecipientLabel: "Penerima dana",
    payoutScheduleLabel: "Waktu pencairan",
    payoutScheduleValue:
      "Donasi langsung dapat diklaim pemilik; dana pendamping tersedia setelah musim difinalisasi.",
    storyHeading: "Tentang kampanye ini",
    raisedLabel: "Total donasi langsung",
    thisRoundHeading: "Musim pencocokan ini",
    donorSuffix: "pendukung",
    projectedMatchLabel: "Proyeksi dana pendamping kuadratik",
    notInRound:
      "Belum termasuk musim pencocokan aktif — donasi langsung tetap dilipatkan pada musim berikutnya.",
    /** Notice shown when a non-Approved campaign is opened directly (owner-shared link). */
    status: {
      Pending: "Kampanye ini masih menunggu kurasi. Donasi dibuka setelah disetujui kurator.",
      Rejected: "Kampanye ini tidak lolos kurasi dan tidak menerima donasi.",
      Cancelled: "Kampanye ini telah dibatalkan.",
    } as Record<string, string>,
    /** Campaign create `/campaign/new` — gated self-serve submission form + IPFS image upload. */
    create: {
      back: "Kembali ke jelajah",
      heading: "Ajukan kampanye",
      subtitle:
        "Ceritakan kampanyemu, unggah satu gambar, lalu kirim untuk kurasi. Setelah disetujui kurator, kampanye tampil publik dan siap menerima donasi.",
      // Gate ladder (mirrors the contribute gate)
      connectPrompt: "Hubungkan wallet Testnet untuk mengajukan kampanye.",
      wrongNetwork: "Alihkan Freighter ke Testnet untuk melanjutkan.",
      tierGateTitle: "Verifikasi dulu",
      tierGateBody: "Kamu perlu verifikasi tingkat Dasar untuk mengajukan kampanye.",
      tierGateCta: "Verifikasi sekarang",
      // Fields
      titleLabel: "Judul kampanye",
      titlePlaceholder: "mis. Sumur bersih untuk Dusun Sumber",
      categoryLabel: "Kategori",
      storyLabel: "Cerita kampanye",
      storyPlaceholder:
        "Jelaskan siapa yang terbantu, apa yang didanai, dan mengapa ini penting.",
      payoutLabel: "Alamat pencairan",
      payoutHelper: "Default: wallet-mu. Dana yang terkumpul dicairkan ke alamat ini.",
      payoutReset: "Pakai wallet saya",
      imageLabel: "Gambar kampanye",
      // Image dropzone
      image: {
        dropPrompt: "Seret gambar ke sini atau pilih berkas",
        dropHint: "PNG atau JPG, disematkan ke IPFS",
        pickFile: "Pilih berkas",
        uploading: "Mengunggah gambar…",
        replace: "Ganti gambar",
        remove: "Hapus",
        cidLabel: "CID",
        errorFallback: "Gagal menyematkan gambar. Coba lagi.",
        previewAlt: "Pratinjau gambar kampanye",
      },
      // Client-side validation
      invalid: {
        titleRequired: "Judul wajib diisi.",
        titleTooLong: "Judul maksimal 96 karakter.",
        storyRequired: "Cerita wajib diisi.",
        storyTooLong: "Cerita maksimal 1024 karakter.",
        payoutInvalid: "Alamat Stellar tidak valid (diawali G, 56 karakter).",
        imageRequired: "Unggah satu gambar kampanye.",
      } as Record<string, string>,
      // Submit tx
      submit: "Kirim untuk kurasi",
      awaiting: "Buka Freighter untuk menandatangani…",
      submitting: "Mengirim transaksi…",
      // Success
      successTitle: "Kampanye terkirim — menunggu kurasi",
      successBody:
        "Kampanyemu tercatat on-chain dengan status Menunggu kurasi. Setelah kurator menyetujui, kampanye tampil publik dan bisa menerima donasi.",
      viewCampaign: "Lihat kampanye",
      createAnother: "Ajukan kampanye lain",
    },
    /** The "Jejak on-chain" panel: how one contribution flows through the contract. `fn` names
     * render inline as machine artifacts; only the human copy localizes. */
    jejak: {
      tag: "Jejak on-chain",
      heading: "Ke mana Rp50 ribu-mu pergi",
      steps: [
        "Donasimu tercatat di contract dengan alamat, jumlah, dan ledger.",
        "Kontribusimu menaikkan bobot (Σ√c)² kampanye ini — sinyal publik, bukan janji.",
        "Di akhir musim, dana pendamping dibagi mengikuti sinyal itu. Bisa diaudit siapa pun.",
      ],
      artifactsLabel: (id: number) => `Artefak kampanye #${id}`,
      categoryLabel: "kategori",
    },
    /** The public backer ledger under the story — recent `contrib` events for this campaign. */
    ledger: {
      heading: "Aktivitas kampanye",
      body: "Setiap donasi masuk dan setiap pencairan ke pemilik — direkonstruksi langsung dari event log contract, tanpa backend di tengah.",
      empty: "Belum ada aktivitas on-chain dalam jendela retensi RPC.",
      retention: "Hanya event dalam jendela retensi RPC Testnet yang ditampilkan.",
      filterAll: "Semua",
      filterIn: "Donasi",
      filterOut: "Pencairan",
      summaryIn: "donasi masuk",
      summaryOut: "dicairkan ke pemilik",
      payoutLabel: "Dicairkan ke pemilik",
      roundTag: (r: number) => `ronde #${r}`,
      showMore: "Lihat lebih banyak",
      showLess: "Lihat lebih sedikit",
    },
    contribute: {
      cta: "Ikut patungan",
      amountLabel: "Pilih jumlah",
      customChip: "Jumlah lain",
      customPlaceholder: "cth. 25000",
      customInvalid: "Masukkan jumlah bulat positif.",
      confirm: "Tinjau donasi",
      reviewTitle: "Tinjau sebelum tanda tangan",
      reviewBody:
        "Freighter akan meminta tanda tangan setelah kamu mengonfirmasi. Pastikan jumlah, kampanye, dan penerima sudah benar.",
      reviewCampaign: "Kampanye",
      reviewAmount: "Jumlah donasi",
      reviewRecipient: "Penerima",
      reviewNetwork: "Jaringan",
      reviewSubmit: "Konfirmasi & buka Freighter",
      reviewBack: "Ubah jumlah",
      awaiting: "Buka Freighter untuk menandatangani…",
      submitting: "Mengirim transaksi…",
      successTitle: "Terima kasih — urunanmu tercatat on-chain.",
      done: "Selesai",
      cancel: "Batal",
      connectPrompt: "Hubungkan wallet Testnet untuk ikut urunan.",
      wrongNetwork: "Alihkan Freighter ke Testnet untuk melanjutkan.",
      tierGateTitle: "Verifikasi dulu",
      tierGateBody: "Kamu perlu verifikasi tingkat Dasar untuk ikut urunan.",
      tierGateCta: "Verifikasi sekarang",
    },
  },
  project: {
    backToLanding: "Kembali ke beranda",
    notFound: "Proyek tidak ditemukan.",
    raisedLabel: "Terkumpul",
    contributeCta: "Ikut patungan",
    roundClosedCta: "Round ditutup",
    stories: {
      0: "Atap Sekolah SDN 2 bocor setiap musim hujan. Urunan ini mengganti atap seng agar anak-anak belajar dengan aman dan kering.",
      1: "Kebun Warga RW 5 memasok sayur segar untuk posyandu. Urunan ini membeli bibit dan alat tani sederhana.",
      2: "Dusun Sumber berjalan jauh setiap hari mengambil air bersih. Urunan ini mendanai sumur bor untuk warga.",
    } as Record<number, string>,
  },
  contribute: {
    title: "Urun untuk",
    amountLabel: "Pilih jumlah",
    connectFirst: "Hubungkan wallet Testnet untuk melanjutkan.",
    confirmCta: "Kirim & tanda tangani",
    awaitingSignature: "Buka Freighter untuk menandatangani…",
    submitting: "Mengirim transaksi…",
    successTitle: "Urunan berhasil!",
    viewOnExplorer: "Lihat transaksi di Explorer",
    close: "Tutup",
    cancel: "Batal",
    errors: {
      NotVerified: "Alamat belum terverifikasi.",
      RoundClosed: "Musim sudah ditutup untuk kontribusi baru.",
      UnknownProject: "Proyek tidak ditemukan.",
      InvalidAmount: "Jumlah tidak valid.",
      rejected: "Tanda tangan dibatalkan.",
      generic: "Transaksi gagal. Coba lagi.",
    } as Record<string, string>,
  },
  /**
   * Seasons archive `/seasons` — every matching round as a reverse-chronological
   * ledger: the "this platform runs season after season" surface. Bahasa-first.
   */
  seasons: {
    title: "Arsip musim",
    subtitle:
      "Setiap musim pencocokan yang pernah dibuka, dari yang terbaru. Musim yang selesai menampilkan kampanye dengan dana pendamping terbesar.",
    seasonLabel: (id: number) => `Musim #${id}`,
    poolLabel: "Dana pendamping",
    sponsorLabel: "Sponsor",
    scopeLabel: "Kategori",
    scopeAll: "Semua kategori",
    // Status pills (reuse the dashboard tones)
    status: {
      Open: "Berlangsung",
      Finalized: "Selesai",
      Cancelled: "Dibatalkan",
    } as Record<string, string>,
    // Open round line
    liveEndsIn: "Berakhir dalam",
    liveEnded: "Menunggu finalisasi",
    liveProjection: "Proyeksi pencocokan berjalan",
    countdown: { day: " hr", hour: " jam", min: " mnt", ended: "Berakhir" },
    // Finalized leaderboard
    topHeading: "Pendamping terbesar",
    noMatches: "Tidak ada kampanye yang dicocokkan musim ini.",
    cancelledNote: "Musim ini dibatalkan sebelum finalisasi. Dana dikembalikan ke sponsor.",
    viewResults: "Lihat hasil",
    // States
    empty: "Belum ada musim pencocokan.",
    emptyHint: "Musim pertama akan muncul di sini setelah sponsor membukanya.",
  },
  /**
   * Round-scoped results `/results?round=` — the quadratic split reveal for one
   * season: per-campaign direct vs matched, ranked, with the crowd-beats-whale verdict.
   */
  results: {
    title: "Hasil pencocokan",
    seasonLabel: (id: number) => `Musim #${id}`,
    notFinalized: "Musim belum difinalisasi. Berikut proyeksi pencocokan berdasarkan kontribusi saat ini.",
    finalized: "Hasil final musim ini.",
    roundPickerLabel: "Musim",
    directLabel: "Langsung",
    matchedLabel: "Pendamping",
    directDefinition: "Langsung: total donasi yang benar-benar diberikan pendukung pada musim ini.",
    matchedDefinition: "Pendamping: tambahan dari dana sponsor yang dibagi dengan rumus kuadratik.",
    barHint: "Panjang bar menunjukkan total dana; warna menunjukkan sumber dananya.",
    openCampaign: "Buka kampanye",
    donorSuffix: "pendukung",
    poolLabel: "Dana pendamping",
    totalMatchedLabel: "Total dana pendamping dibagikan",
    verdict: "Dana pendamping mengikuti jumlah pendukung, bukan besar donasi.",
    // States
    empty: "Belum ada kontribusi untuk dicocokkan musim ini.",
    emptyHint: "Hasil akan muncul setelah kampanye menerima donasi dalam musim ini.",
    notFoundTitle: "Musim tidak ditemukan",
    notFoundBody: "Musim ini mungkin belum ada, atau tautannya keliru.",
    backToSeasons: "Lihat arsip musim",
    noRounds: "Belum ada musim pencocokan.",
    barLabel: "Perbandingan donasi langsung dan dana pendamping",
    slowLoad: "Data on-chain memuat lebih lama dari biasanya.",
  },
  /**
   * Operator/sponsor console `/operator` — the deepest, most privileged surface.
   * Five write actions grouped by blast radius: the season lifecycle (open → fund → finalize) and
   * governance (curation queue, verify fallback). All copy Bahasa-first.
   */
  operator: {
    title: "Konsol Operator",
    subtitle:
      "Jalankan satu musim pencocokan penuh: buka musim, isi dana, kurasi kampanye, lalu finalisasi.",
    // Gate ladder
    connectPrompt: "Hubungkan wallet operator untuk mengakses konsol ini.",
    notRole:
      "Wallet yang terhubung bukan pemegang peran operator (admin, kurator, atau verifikator).",
    wrongNetwork: "Alihkan Freighter ke Testnet untuk melanjutkan.",
    // Shared tx phases
    awaiting: "Buka Freighter untuk menandatangani…",
    submitting: "Mengirim transaksi…",
    // Status strip — the anchor every action is read against
    status: {
      connectedAs: "Terhubung sebagai",
      roles: "Peran",
      roleAdmin: "Admin",
      roleCurator: "Kurator",
      roleAttester: "Verifikator",
      liveRound: "Musim berjalan",
      noRound: "Belum ada musim terbuka",
      poolLabel: "Dana pendamping",
      scopeAll: "Semua kategori",
      endsLabel: "Berakhir",
      ended: "Berakhir",
    },
    // Region headings
    lifecycleHeading: "Musim pencocokan",
    governanceHeading: "Tata kelola",
    // Section overlines / step numbers
    step: { open: "01 · Buka musim", fund: "02 · Isi dana", finalize: "03 · Finalisasi" },
    // 1 · Open round
    open: {
      heading: "Buka musim pencocokan",
      description:
        "Mulai musim baru: tetapkan tanggal berakhir dan kategori yang dicocokkan. Hanya satu musim bisa terbuka pada satu waktu.",
      endLabel: "Tanggal berakhir",
      endHelper: "Ditampilkan sebagai hitung mundur ke donatur.",
      categoriesLabel: "Kategori dalam musim",
      categoriesHint: "Kosongkan untuk mencocokkan semua kategori.",
      cta: "Buka musim",
      successTitle: "Musim dibuka!",
      alreadyOpen: (id: number) => `Musim #${id} sedang berjalan. Finalisasi dulu untuk membuka yang baru.`,
      invalidDate: "Pilih tanggal berakhir di masa depan.",
    },
    // 2 · Fund pool
    fund: {
      heading: "Isi dana pendamping",
      description:
        "Setor dana pendamping untuk musim yang sedang berjalan. Butuh verifikasi tingkat Institusi.",
      amountLabel: "Jumlah dana (IDR)",
      echoLabel: "Akan menyetor",
      cta: "Kirim dana",
      successTitle: "Dana pendamping terkirim!",
      invalidAmount: "Masukkan jumlah bulat positif.",
      needsRound: "Buka musim dulu sebelum mengisi dana.",
      tierGateTitle: "Perlu tingkat Institusi",
      tierGateBody:
        "Hanya wallet terverifikasi Institusi yang boleh mengisi dana pendamping. Gunakan konsol verifikasi di bawah untuk menaikkan tingkat wallet ini.",
    },
    // 3 · Finalize
    finalize: {
      heading: "Finalisasi musim",
      description:
        "Menutup musim untuk kontribusi baru dan menghitung pencocokan kuadratik. Tidak bisa dibatalkan.",
      cta: "Finalisasi musim",
      confirmMessage: "Finalisasi tidak bisa dibatalkan. Lanjutkan?",
      confirmCta: "Ya, finalisasi sekarang",
      cancelCta: "Batal",
      successTitle: "Musim difinalisasi!",
      viewResults: "Lihat hasil",
      needsRound: "Belum ada musim terbuka untuk difinalisasi.",
    },
    // 4 · Curation queue
    curation: {
      heading: "Antrean kurasi",
      description: "Kampanye baru menunggu persetujuan sebelum tampil publik dan menerima donasi.",
      empty: "Tidak ada kampanye yang menunggu kurasi.",
      pendingBadge: "Menunggu",
      approve: "Setujui",
      reject: "Tolak",
      approving: "Menyetujui…",
      rejecting: "Menolak…",
      byOwner: "Oleh",
      approvedToast: "Kampanye disetujui.",
      rejectedToast: "Kampanye ditolak.",
    },
    // 5 · Verify fallback
    verify: {
      heading: "Verifikasi manual",
      description:
        "Tetapkan tingkat verifikasi untuk sebuah alamat — jalur pengganti testnet untuk KYC anchor.",
      addressLabel: "Alamat wallet (G…)",
      tierLabel: "Tingkat",
      tiers: { None: "Tidak ada", Basic: "Dasar", Institution: "Institusi" } as Record<string, string>,
      cta: "Tetapkan tingkat",
      successTitle: "Tingkat verifikasi ditetapkan!",
      invalidAddress: "Alamat Stellar tidak valid (diawali G, 56 karakter).",
    },
    viewOnExplorer: "Lihat transaksi di Explorer",
    /** Error overrides specific to operator actions; anything omitted falls back to shared strings.errors. */
    errors: {
      RoundAlreadyOpen: "Sudah ada musim yang berjalan.",
      RoundNotOpen: "Musim sudah tidak dibuka untuk aksi ini.",
      AlreadyFinalized: "Musim sudah difinalisasi.",
      NothingToMatch: "Belum ada kontribusi untuk dicocokkan.",
      TierTooLow: "Tingkat verifikasi belum mencukupi (butuh Institusi).",
      NotAdmin: "Hanya admin yang dapat melakukan aksi ini.",
      NotCurator: "Hanya kurator yang dapat melakukan aksi ini.",
      NotAttester: "Hanya verifikator yang dapat melakukan aksi ini.",
      ProjectNotPending: "Kampanye tidak sedang menunggu kurasi.",
      InvalidAmount: "Jumlah tidak valid.",
      rejected: "Tanda tangan dibatalkan.",
      generic: "Transaksi gagal. Coba lagi.",
    } as Record<string, string>,
  },
  /**
   * Owner dashboard `/dashboard` — a reconciliation ledger of the campaigns the
   * connected wallet has submitted (every status), their lifetime direct total, and the per-season
   * matched payout each finalized round owes, with self-serve claim. Bahasa-first.
   */
  dashboard: {
    title: "Dasbor saya",
    subtitle:
      "Kampanye yang kamu ajukan, total donasi yang terkumpul, dan pencairan dana pendamping tiap musim.",
    createCta: "Ajukan kampanye",
    summary: { campaigns: "Total kampanye", active: "Aktif", raised: "Total donasi", claimable: "Siap diklaim" },
    filters: {
      label: "Filter kampanye",
      all: "Semua",
      active: "Aktif",
      pending: "Menunggu",
      action: "Perlu tindakan",
      empty: "Tidak ada kampanye pada filter ini.",
    },
    actionCenter: {
      title: "Dana siap dicairkan",
      body: (n: number) => `${n} kampanye memiliki donasi di luar musim yang menunggu tindakanmu.`,
      cta: "Tinjau sekarang",
    },
    insights: {
      show: "Lihat insight",
      hide: "Tutup insight",
      trend: "Tren donasi terbaru",
      activity: "Aktivitas terbaru",
      empty: "Belum ada event donasi dalam jendela retensi Testnet.",
      donor: "Pendukung",
      viewTx: "Lihat transaksi",
    },
    // Gate ladder (owners need no verification tier — just a Testnet wallet)
    connectPrompt: "Hubungkan wallet Testnet untuk melihat kampanyemu.",
    wrongNetwork: "Alihkan Freighter ke Testnet untuk melanjutkan.",
    // Empty state
    empty: "Kamu belum punya kampanye.",
    emptyHint: "Ajukan kampanye pertamamu untuk mulai menerima donasi dan dana pendamping.",
    // Per-campaign
    statusPill: {
      Pending: "Menunggu kurasi",
      Approved: "Aktif",
      Rejected: "Ditolak",
      Cancelled: "Dibatalkan",
    } as Record<string, string>,
    lifetimeLabel: "Total donasi langsung",
    seasonsHeading: "Pencairan per musim",
    seasonsLoading: "Memuat pencairan…",
    noSeasons: "Kampanye ini belum ikut musim pencocokan yang difinalisasi.",
    // Per finalized round
    round: {
      label: (id: number) => `Musim #${id}`,
      directLabel: "Langsung",
      donorSuffix: "pendukung",
      matchedLabel: "Pendamping",
      claim: "Klaim dana pendamping",
      claiming: "Mengklaim…",
      claimed: "Sudah diklaim",
      nothing: "Tanpa dana pendamping musim ini",
    },
    // Campaign-level claim of donations received while no round was open
    direct: {
      heading: "Donasi di luar musim",
      body: "Donasi yang masuk saat tak ada musim aktif — bisa dicairkan kapan saja.",
      claim: "Klaim donasi langsung",
      claiming: "Mengklaim…",
      claimed: "Donasi langsung telah dicairkan.",
    },
    // Shared tx phases
    awaiting: "Buka Freighter untuk menandatangani…",
    submitting: "Mengirim transaksi…",
    claimedTitle: "Dana berhasil diklaim!",
    viewOnExplorer: "Lihat transaksi di Explorer",
  },
  /**
   * Contributor account `/account` — "me": my verification tier, my total impact,
   * and my past direct donations reconstructed from on-chain `contrib` events, grouped by campaign.
   */
  account: {
    title: "Kontribusi saya",
    subtitle:
      "Riwayat donasi langsungmu, direkonstruksi dari catatan on-chain — dikelompokkan per kampanye.",
    // Gate ladder (a contributor only needs a Testnet wallet to see their own history)
    connectPrompt: "Hubungkan wallet Testnet untuk melihat riwayat kontribusimu.",
    wrongNetwork: "Alihkan Freighter ke Testnet untuk melanjutkan.",
    // Header ledger figure (quiet total, not a hero card)
    tierLabel: "Verifikasi",
    tier: { None: "Belum terverifikasi", Basic: "Dasar", Institution: "Institusi" } as Record<
      string,
      string
    >,
    impactLabel: "Total dampak saya",
    campaignCount: (n: number) => `${n} kampanye`,
    giftCount: (n: number) => `${n} donasi`,
    // Per-campaign group
    myTotalLabel: "Donasiku",
    unknownCampaign: (id: number) => `Kampanye #${id}`,
    viewCampaign: "Lihat kampanye",
    viewTx: "Lihat di Explorer",
    // Empty state
    empty: "Kamu belum berdonasi.",
    emptyHint:
      "Donasi pertamamu akan muncul di sini, tercatat langsung dari transaksi on-chain.",
    exploreCta: "Jelajahi kampanye",
    // Retention caveat — testnet RPC prunes old events; keep the reconstruction honest.
    retentionNote:
      "Hanya donasi dalam jendela retensi RPC Testnet yang bisa ditampilkan.",
  },
  /** Tier-aware verification badge labels + one-line unlock captions (`TierBadge`). */
  tierBadge: {
    currentLabel: "Tingkat verifikasi kamu",
    tiers: {
      None: "Belum terverifikasi",
      Basic: "Terverifikasi Dasar",
      Institution: "Terverifikasi Institusi",
    } as Record<string, string>,
    unlocks: {
      None: "Verifikasi untuk mulai ikut urunan dan mengajukan kampanye.",
      Basic: "Kamu bisa ikut urunan dan mengajukan kampanye.",
      Institution: "Kamu bisa ikut urunan, mengajukan kampanye, dan mengisi dana pendamping.",
    } as Record<string, string>,
  },
  /**
   * Verification flow `/verify` — a linear 3-step trust ladder: see your tier,
   * prove wallet ownership to the anchor (SEP-10), then get a tier attested. On testnet the anchor's
   * KYC is a clearly-labeled stand-in; the attester (operator) writes the tier. Bahasa-first.
   */
  verify: {
    title: "Verifikasi",
    subtitle:
      "Verifikasi sekali untuk membuka urunan dan pengajuan kampanye. Data identitasmu tak pernah tersimpan di sini — hanya tingkat verifikasinya yang tercatat on-chain.",
    // Gate ladder
    connectPrompt: "Hubungkan wallet Testnet untuk mulai verifikasi.",
    wrongNetwork: "Alihkan Freighter ke Testnet untuk melanjutkan.",
    // What each tier unlocks — the ladder rail
    ladderHeading: "Yang terbuka di tiap tingkat",
    ladder: [
      { tier: "Dasar", unlock: "Ikut urunan & ajukan kampanye" },
      { tier: "Institusi", unlock: "Isi dana pendamping sebagai sponsor" },
    ],
    // Step 1 — SEP-10 ownership
    sep10: {
      overline: "01 · Bukti kepemilikan",
      heading: "Buktikan kamu pemilik wallet ini",
      description:
        "Tanda tangani tantangan dari anchor (SEP-10) untuk membuktikan kepemilikan wallet. Tidak ada dana yang berpindah.",
      cta: "Mulai bukti kepemilikan",
      pending: "Menghubungi anchor…",
      awaiting: "Buka Freighter untuk menandatangani…",
      successTitle: "Kepemilikan terbukti",
      successBody: "Anchor menerbitkan token sesi. Lanjut ke penetapan tingkat.",
      notConfiguredTitle: "Anchor belum dikonfigurasi",
      notConfiguredBody:
        "Belum ada anchor SEP-10 yang tersambung di lingkungan ini. Kamu tetap bisa memakai jalur penetapan tingkat simulasi testnet di bawah.",
      errors: {
        "not-configured": "Anchor belum dikonfigurasi di lingkungan ini.",
        toml: "Endpoint SEP-10 anchor tidak ditemukan.",
        challenge: "Anchor menolak permintaan verifikasi. Coba lagi.",
        "invalid-challenge": "Tantangan dari anchor tidak valid.",
        signature: "Tanda tangan dibatalkan.",
        token: "Anchor menolak tanda tangan. Coba lagi.",
        network: "Gagal menghubungi anchor. Periksa koneksi lalu coba lagi.",
        generic: "Verifikasi anchor gagal. Coba lagi.",
      } as Record<string, string>,
    },
    // Step 1.5 — SEP-12 KYC fields (real, only when the anchor publishes a KYC_SERVER)
    kyc: {
      overline: "01b · Data KYC",
      heading: "Kirim data KYC ke anchor",
      description:
        "Anchor ini mempublikasikan layanan KYC (SEP-12). Isi data singkat berikut untuk diperiksa oleh anchor.",
      firstName: "Nama depan",
      lastName: "Nama belakang",
      email: "Email",
      cta: "Kirim ke anchor",
      submitting: "Mengirim ke anchor…",
      polling: "Memeriksa status di anchor…",
      status: {
        NEEDS_INFO: "Anchor meminta data tambahan.",
        PROCESSING: "Anchor sedang memproses pengajuanmu.",
        PENDING: "Menunggu keputusan anchor.",
        ACCEPTED: "Anchor menyetujui KYC-mu. Lanjut ke penetapan tingkat.",
        REJECTED: "Anchor menolak pengajuan KYC ini.",
      } as Record<string, string>,
      errors: {
        "not-configured": "Anchor belum dikonfigurasi di lingkungan ini.",
        "kyc-not-configured":
          "Anchor ini tidak mempublikasikan layanan KYC (SEP-12) — lanjut lewat jalur penetapan tingkat simulasi testnet di bawah.",
        "kyc-rejected": "Anchor menolak pengajuan KYC. Coba lagi.",
        network: "Gagal menghubungi anchor. Periksa koneksi lalu coba lagi.",
        generic: "Pengajuan KYC gagal. Coba lagi.",
      } as Record<string, string>,
    },
    // Step 2 — attest (real KYC hand-off, or the simulated testnet stand-in)
    attest: {
      overline: "02 · Penetapan tingkat",
      heading: "Dapatkan tingkat verifikasi",
      simBadge: "Simulasi testnet",
      realBadge: "KYC anchor diterima",
      description:
        "Di produksi, anchor menyetujui KYC lalu menuliskan tingkatmu. Di testnet, operator (pemegang peran verifikator) berperan sebagai anchor.",
      // Attester-holder path (self-serve on testnet)
      attesterHint:
        "Wallet ini memegang peran verifikator — kamu bisa menetapkan tingkat langsung sebagai stand-in anchor.",
      tierLabel: "Tingkat",
      tiers: { Basic: "Dasar", Institution: "Institusi" } as Record<string, string>,
      cta: "Setujui (simulasi KYC)",
      successTitle: "Tingkat verifikasi ditetapkan!",
      // Non-attester fallback
      fallbackTitle: "Menunggu penetapan tingkat oleh operator",
      fallbackBody:
        "Di testnet, penetapan tingkat diselesaikan oleh operator sebagai pengganti anchor. Kepemilikan wallet-mu sudah terbukti — minta operator menetapkan tingkatmu lewat konsol.",
      fallbackCta: "Buka konsol operator",
      alreadyTitle: "Kamu sudah terverifikasi",
      alreadyBody: "Tak perlu langkah lain. Kamu siap ikut urunan.",
      exploreCta: "Jelajahi kampanye",
    },
    // Shared tx phases
    submitting: "Mengirim transaksi…",
    viewOnExplorer: "Lihat transaksi di Explorer",
    tierError: "Gagal memuat tingkat verifikasi. Coba lagi.",
  },
  wallet: {
    connect: "Hubungkan Wallet",
    connecting: "Menghubungkan…",
    disconnect: "Putuskan Wallet",
    notInstalled: "Pasang Freighter",
    wrongNetworkPill: "Jaringan salah",
    testnetPill: "Testnet",
    wrongNetworkBanner:
      "Freighter tidak terhubung ke Testnet. Alihkan jaringan di Freighter untuk melanjutkan.",
    connectFailed: "Gagal menghubungkan wallet. Coba lagi.",
  },
  explorer: {
    viewTx: "Lihat transaksi di Explorer",
    viewContract: "Lihat kontrak di Explorer",
  },
  footer: {
    transparency: "Setiap aksi tercatat on-chain di Stellar Testnet.",
  },
  /** Branded top-level 404 (`app/not-found.tsx`). */
  notFound: {
    title: "Halaman tidak ditemukan",
    body: "Rute ini tidak ada di ledger. Periksa tautannya, atau kembali ke beranda.",
    cta: "Kembali ke beranda",
  },
  loading: "Memuat…",
  empty: "Belum ada proyek",
  errorGeneric: "Terjadi kesalahan. Coba lagi.",
  retry: "Coba lagi",
  staleData: "Gagal memuat pembaruan — menampilkan data terakhir.",
  /**
   * Shared Bahasa fallback for every contract `Error` variant (mapped by name via
   * `mapContractError`). Context-specific screens may override individual keys by passing their
   * own map; anything they omit falls back here, so no rejection ever renders raw internals.
   */
  errors: {
    AlreadyInitialized: "Kontrak sudah diinisialisasi.",
    NotAdmin: "Hanya admin yang dapat melakukan aksi ini.",
    NotVerified: "Alamat belum terverifikasi.",
    RoundClosed: "Musim sudah ditutup untuk kontribusi baru.",
    RoundNotOpen: "Musim sudah tidak dibuka untuk aksi ini.",
    AlreadyFinalized: "Musim sudah difinalisasi.",
    NotFinalized: "Musim belum difinalisasi.",
    UnknownProject: "Kampanye tidak ditemukan.",
    DuplicateProject: "Kampanye sudah terdaftar.",
    AlreadyDisbursed: "Dana kampanye ini sudah dicairkan.",
    InvalidAmount: "Jumlah tidak valid.",
    NothingToMatch: "Belum ada kontribusi untuk dicocokkan.",
    NotCurator: "Hanya kurator yang dapat melakukan aksi ini.",
    ProjectNotApproved: "Kampanye belum disetujui kurator.",
    ProjectNotPending: "Kampanye tidak sedang menunggu kurasi.",
    AlreadyClaimed: "Bagian musim ini sudah diklaim.",
    UnknownRound: "Musim tidak ditemukan.",
    RoundAlreadyOpen: "Sudah ada musim yang dibuka.",
    CategoryNotInRound: "Kategori kampanye tidak termasuk dalam musim ini.",
    TierTooLow: "Tingkat verifikasi belum mencukupi untuk aksi ini.",
    NothingToClaim: "Tidak ada dana untuk diklaim.",
    NotOwner: "Hanya pemilik kampanye yang dapat melakukan aksi ini.",
    NotAttester: "Hanya verifikator yang dapat melakukan aksi ini.",
    InvalidCid: "CID gambar tidak valid.",
    InvalidTitle: "Judul tidak valid.",
    rejected: "Tanda tangan dibatalkan.",
    generic: "Transaksi gagal. Coba lagi.",
  } as Record<string, string>,
};

export type Strings = typeof id;
