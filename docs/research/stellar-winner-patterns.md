# Research — Stellar Hackathon Winner Patterns (2024–2026)

> Informal research note (in Bahasa Indonesia) surveying past Stellar/Rise In hackathon
> winners to reverse-engineer what judges reward. Feeds the "how we win the rubric"
> thinking in [`../prd.md`](../prd.md) §13. Source links are at the bottom.

---

Aku sempat cek, dan ada satu hal penting:

> **APAC Stellar Hackathon 2026 adalah penyelenggaraan pertama** untuk format APAC ini. Jadi **belum ada pemenang APAC Stellar Hackathon sebelumnya**. ([Rise In][1])

Namun, kita bisa melihat hackathon Stellar lain yang diselenggarakan oleh Stellar dan Rise In karena pola penilaiannya sangat mirip.

## 1. Stellar Hack Pera 2025 (Turki)

Ini adalah hackathon offline yang juga diselenggarakan bersama Rise In dan Stellar. Ada lebih dari **70 proyek** dan hadiah total **$25.000**. ([Rise In][2])

### 🥇 Kale Predict

**Apa yang dibuat?**

Prediction market.

Pengguna bisa bertaruh apakah suatu metrik blockchain akan naik atau turun.

Misalnya:

* Total transaksi Stellar minggu depan naik?
* TVL DeFi naik?

Semuanya dijalankan menggunakan smart contract Soroban.

**Kenapa menang?**

* Memanfaatkan blockchain sebagai inti aplikasi.
* Ada use case nyata.
* Produk selesai dan dapat digunakan.

---

### 🥈 Luminate

Ini menurutku menarik.

Mereka membuat:

> **Platform publishing berbasis AI + blockchain.**

Fitur:

* Penulis mengunggah artikel.
* AI membantu membuat konten.
* Pembaca memberi reward menggunakan Stellar.
* Semua insentif tercatat di blockchain.

Bahkan proyek ini sudah **berjalan di mainnet** saat hackathon berlangsung. ([Rise In][2])

---

### 🥉 BrainOn

Ini unik.

Mereka menghubungkan:

* Brainwave (EEG)
* Hardware
* Blockchain

Jadi aktivitas otak dapat memicu aksi di blockchain.

Misalnya:

```
Brain Signal

↓

Hardware

↓

Blockchain Transaction
```

Ini menunjukkan bahwa juri juga menghargai inovasi lintas disiplin. ([Rise In][2])

---

### DJai

Platform AI yang membuat musik bebas copyright.

Blockchain digunakan untuk:

* pembayaran
* pembagian royalti

AI + blockchain dipadukan menjadi satu produk. ([Rise In][2])

---

# 2. HackStellar Istanbul 2026

Hackathon ini juga diselenggarakan oleh Rise In.

## 🥇 Stellar x402 Ecosystem

Mereka membuat implementasi protokol **HTTP 402** di Stellar.

Artinya:

Website bisa menerima pembayaran mikro langsung menggunakan XLM.

Misalnya:

```
Baca artikel premium

↓

Bayar Rp100

↓

Artikel terbuka
```

Tidak perlu kartu kredit atau langganan bulanan. ([LinkedIn][3])

---

## 🥈 Reset

Ini adalah:

> **Yield Aggregator**

AI membantu memilih tempat terbaik untuk menyimpan aset agar memperoleh hasil (yield) optimal.

Mereka juga menambahkan:

* proteksi risiko
* manajemen aset

Ini adalah contoh proyek DeFi yang matang. ([LinkedIn][3])

---

# 3. Consensus x EasyA Stellar Hackathon 2024

Tema besarnya adalah:

> **Cash to DeFi**

Artinya menghubungkan uang dunia nyata dengan DeFi.

Contoh proyek yang menonjol:

* integrasi MoneyGram
* dompet digital
* USDC
* pembayaran lintas negara
* protokol DeFi

Semuanya berfokus pada **keuangan yang benar-benar bisa digunakan**, bukan sekadar demo blockchain. ([Stellar][4])

---

# Pola yang mulai terlihat

Kalau kita lihat semua pemenangnya, ada pola yang konsisten.

| Jenis Proyek             | Sering Menang?     |
| ------------------------ | ------------------ |
| Wallet                   | ✅                  |
| Payment                  | ✅                  |
| AI + Blockchain          | ✅                  |
| DeFi                     | ✅                  |
| Cross-border payment     | ✅                  |
| Real-world finance       | ✅                  |
| NFT Marketplace          | ❌ Hampir tidak ada |
| Meme Coin                | ❌                  |
| Voting Blockchain        | ❌                  |
| To-do List di Blockchain | ❌                  |

---

# Yang menarik

Yang membuatku cukup terkejut adalah:

**Hampir tidak ada pemenang yang hanya "pakai blockchain".**

Sebaliknya, yang menang biasanya mengikuti pola seperti ini:

```
Masalah nyata

↓

Produk yang berguna

↓

Blockchain menjadi solusi

↓

UI/UX bagus

↓

Demo berjalan
```

Bukan:

```
Blockchain

↓

Cari masalah
```

---

# Insight yang menurutku paling penting

Kalau melihat tren hackathon Stellar sejak 2024 hingga 2026, aku melihat tiga karakteristik yang sering muncul pada proyek pemenang:

1. **Masalahnya mudah dipahami dalam 30 detik.** Misalnya pembayaran lintas negara, platform konten, atau pembayaran mikro.
2. **Blockchain memang diperlukan.** Misalnya karena membutuhkan pembayaran murah, aset digital, atau smart contract. Jika blockchain dihapus dan aplikasi tetap sama, biasanya idenya kurang kuat.
3. **Ada nilai tambah di luar blockchain.** AI, UX yang baik, integrasi dengan layanan lain, atau fokus pada pengguna nyata sering menjadi pembeda.

Kalau tujuanmu adalah mengejar juara di APAC Stellar Hackathon, menurutku jangan mulai dengan bertanya *"fitur blockchain apa yang bisa dipakai?"*, tetapi mulai dari *"masalah keuangan apa yang benar-benar dialami orang di Indonesia atau APAC?"*. Dari sana baru pilih kemampuan Stellar yang paling tepat untuk menyelesaikan masalah tersebut. Itu sangat sejalan dengan tema resmi hackathon: **real-world financial applications**.

[1]: https://www.risein.com/programs/apac-stellar-hackathon?utm_source=chatgpt.com "APAC Stellar Hackathon | Rise In"
[2]: https://www.risein.com/blog/stellar-hack-pera-turkeys-largest-irl-web3-hackathon-with-200-participants-70-projects?utm_source=chatgpt.com "Stellar Hack Pera: Turkey’s Largest IRL Web3 Hackathon with 200+ Participants, 70+ Projects | Rise In"
[3]: https://www.linkedin.com/posts/risein_hackstellar-hackathon-winners-activity-7401250445479972866-AclP?utm_source=chatgpt.com "HackStellar Winners: Stellar x402 Ecosystem Takes 1st Place | Rise In posted on the topic | LinkedIn"
[4]: https://stellar.org/blog/foundation-news/cash-to-defi-the-consensus-x-easya-2024-stellar-hackathon?utm_source=chatgpt.com "Stellar | Cash-to-DeFi: the Consensus X EasyA 2024 Stellar Hackathon"
