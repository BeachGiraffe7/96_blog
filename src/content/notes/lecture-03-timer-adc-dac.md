# 米醋电子工作室-TI M0系列 第三讲 TIMER计数 & DAC & ADC & DMA Ringbuffer

ADC — 单通道 DMA 批采 + 软件环形缓冲

DAC — 硬件定时器 + FIFO + DMA 自动循环

### 模拟 vs 数字

在正式介绍ADC和DAC之前，我们需要先明白两个基本概念：

1. **模拟信号（Analog）：** 这是我们真实世界的语言。比如温度的升降、声音的起伏、光线的明暗。它的特点是**连续不断**的。就像一个没有台阶的平滑斜坡，你可以站在斜坡上的任何一个微小位置。
2. **数字信号（Digital）：** 这是计算机和 单片机MCU（比如MSPM0G3507）的语言。计算机的脑子里只有 `0` 和 `1`。数字信号就像是**楼梯**，你只能站在某一个具体的台阶上，不能悬停在两个台阶之间。

既然 MCU 只能听懂“楼梯”语言，而真实世界说的是“斜坡”语言，它们要怎么交流呢？这就需要翻译官登场了。

### ADC（模数转换器）—— 将“斜坡”变成“楼梯”

**ADC (Analog-to-Digital Converter)** 的作用，就是把真实世界连续的模拟量（通常是电压），转换成 MCU 能看懂的数字。

**生活中的例子：**

想象你在给一辆行驶中的汽车测速（模拟量是连续的）。你不可能记录下汽车每一微秒的准确位置，你只能每隔一秒钟，用相机拍一张照，然后记录下照片里汽车的位置（转换成具体的数字）。

在这个过程中，有两个极其重要的参数，决定了你的“照片”有多清晰：

- **分辨率（位数）：楼梯有多少级？**
  - 分辨率决定了 MCU 衡量电压的尺子有多精细。通常用 **12位 (12-bit) 的 ADC**。
  - 这意味着它可以把电压范围划分成 $2^{12} = 4096$ 个台阶。
  - **算一笔账：** 假设你的供电电压是 3.3V，那么每一个台阶（能分辨的最小电压变化）就是 3.3V / 4096 ≈ **0.0008V (0.8mV)**。哪怕电压只微弱地变化了 1mV，单片机都能精准地察觉到！
- **采样率（速度）：你按快门有多快？**
  - 采样率指的是 ADC 一秒钟能测多少次。
  - MSPM0G3507 的 ADC 速度非常快，最高可以达到 **4 Msps**（每秒采样 400 万次）。这就相当于一台超高速摄像机，即使是变化极快的信号（比如电机控制中的电流变化），它也能轻松捕捉，不会漏掉任何细节。

### DAC（数模转换器）—— 用“乐高积木”拼出平滑曲线

**DAC (Digital-to-Analog Converter)** 则是 ADC 的逆过程。它是把 MCU 脑子里的数字信号，还原成真实世界里的模拟电压。

**生活中的例子：**

假设你要画一条完美的平滑曲线（模拟信号），但你手里只有一堆大小固定的乐高积木（数字信号）。你只能用这些积木一层一层地堆叠，尽力去拟合那条曲线。如果积木越小（分辨率越高），你拼出来的边缘就越平滑，远看就越像一条真正的曲线。

# ADC 配置

## Basic Configuration（基本时钟配置）

### ADC Clock Source（ADC 时钟源）

| **选项**           | **说明**                                                    |
| ------------------ | ----------------------------------------------------------- |
| **SYSOSC（当前）** | 片内 32 MHz 系统振荡器，无需外部晶振，精度中等，推荐默认    |
| **ULPCLK**         | 超低功耗时钟，频率低（1~4 MHz），适合低功耗场景，转换速率慢 |
| **HFCLK**          | 高频时钟（本工程 40 MHz HFXT），转换速率最快，功耗较高      |

> ▎ **ADC 时钟决定采样速率上限**。MSPM0G3507 ADC 最高工作时钟 40 MHz，超出则行为未定义。

### ADC Clock Divider（时钟分频）

将上述时钟源再分频后送入 ADC 核心。可选 1/2/4/8/16/24/32/48。

本工程选 **1**（不分频），SYSOSC 32 MHz 直接进 ADC。

### Form SYSOSC Base Freq（SYSOSC 频率范围声明）

告知 ADC 模拟前端当前 ADC 时钟所在的频率范围，ADC 内部模拟电路会据此调整偏置。范围选错会导致转换结果偏差：

| **选项**                    | **适用时钟范围** |
| --------------------------- | ---------------- |
| **1 MHz ~ 4 MHz**           | —                |
| **4 MHz ~ 8 MHz**           | —                |
| **8 MHz ~ 16 MHz**          | —                |
| **16 MHz ~ 32 MHz**         | —                |
| **24 MHz ~ 32 MHz（当前）** | SYSOSC 32 MHz    |

## Sampling Mode Configuration（采样模式配置）

### Conversion Mode（转换模式）

| **选项**              | **说明**                                                     |
| --------------------- | ------------------------------------------------------------ |
| **Single（当前）**    | 每次触发做 1 次转换（使用 `DMA Samples Count=1` 时）或 N 次序列（`DMA Samples Count=N`） |
| **Sequence**          | 连续转换多个 MEM 寄存器（多通道扫描），与 `Single+DMA Samples Count>1` 效果相同 |
| **Window Comparator** | 转换结果与阈值比较，超出范围才触发中断，适合电压监测         |

### Conversion Trigger Source（转换触发源）

| **选项**             | **说明**                                                     |
| -------------------- | ------------------------------------------------------------ |
| **Software（当前）** | 调用 `DL_ADC12_startConversion()` 触发首次；配合 REPEAT 模式后续自动循环 |
| **Event**            | 由硬件事件总线触发（如 Timer CCR 比较事件），实现精确定时采集，无需 CPU 介入 |
| **External Pin**     | 外部引脚边沿触发，适合外部同步信号控制采集时机               |

### Power Down Mode（掉电模式）

| **选项**           | **说明**                                                     |
| ------------------ | ------------------------------------------------------------ |
| **Manual（当前）** | 软件控制上电/掉电，转换期间保持上电，适合高采样率连续采集    |
| **Auto**           | 每次转换前自动上电，转换后自动掉电，省电但增加延迟（上电稳定时间约 40 µs） |

### Sampling Mode（采样启动方式）

| **选项**             | **说明**                                                |
| -------------------- | ------------------------------------------------------- |
| **Auto（当前）**     | 触发后自动开始采样，无需额外信号，采样时间由 SCOMP 决定 |
| **Software Trigger** | 需要额外软件信号启动采样，灵活但增加 CPU 开销           |

### Data Conversion Format（结果格式）

| **选项**                                   | **说明**                                          |
| ------------------------------------------ | ------------------------------------------------- |
| **Binary unsigned, right-aligned（当前）** | 12-bit 结果存在低 12 位（0 ~ 4095），正值，最常用 |
| **Binary signed, right-aligned**           | 有符号，差分模式时使用（-2048 ~ +2047）           |
| **Binary unsigned, left-aligned**          | 结果在高 12 位，低 4 位为 0，便于直接与 DAC 对比  |
| **Binary signed, left-aligned**            | 有符号 + 左对齐                                   |

## ADC Conversion Memory 0 Configuration（MEM0 配置）

### Active Memory Control Blocks（启用的 MEM 数量）

即 `DMA Samples Count`，本工程 = **1**，只使用 MEM0。

可选 1~8，设为 N 时需在下方依次配置 MEM0 到 MEM(N-1) 的输入通道。

### Name（MEM 寄存器名）

生成宏 `ADC12_0_ADCMEM_0`，用于 `DL_ADC12_configConversionMem()` 第二参数。

### Input Channel（输入通道）

| **选项**              | **引脚**    | **说明**                            |
| --------------------- | ----------- | ----------------------------------- |
| **Channel 0 ~ 15**    | 各 ADC 引脚 | 外部模拟输入                        |
| **Channel 3（当前）** | PA24        | 本工程 ADC 输入引脚                 |
| **Internal 0 ~ 7**    | 片内信号    | 温度传感器、VDDA/3、VREF 等内部信号 |

### Reference Voltage（参考电压）

| **选项**           | **说明**                                     |
| ------------------ | -------------------------------------------- |
| **VDDA（当前）**   | 以供电电压为参考（3.3V），简单，但随电源波动 |
| **VREF+ Internal** | 使用内部带隙基准，精度更高，需开启 VREF 模块 |
| **VREF+ External** | 外部精密基准电压源，精度最高                 |

### Sample Timer Preset Source（采样时间计时器）

| **选项**                     | **说明**                                 |
| ---------------------------- | ---------------------------------------- |
| **Sampling Timer 0（当前）** | 使用 SCOMP0，时长 = Sample Time 0 设置值 |
| **Sampling Timer 1**         | 使用 SCOMP1，时长 = Sample Time 1 设置值 |

### Trigger Mode（触发模式/MEM 到 MEM 的跳转方式）

| **选项**              | **说明**                                      |
| --------------------- | --------------------------------------------- |
| **Auto Next（当前）** | 本 MEM 转换完自动进入下一个 MEM，形成序列     |
| **End of Sequence**   | 本 MEM 转换完即结束整个序列，适合最后一个 MEM |

## Advanced Configuration（高级配置）

- **Total Conversion Frequency（总转换频率，只读显示）**
  - SysConfig 根据时钟和采样时间自动计算实际采样率，本工程约 8 kSPS（125 µs 采样时间）。

### Conversion Resolution（转换精度）

| **选项**           | **说明**                           |
| ------------------ | ---------------------------------- |
| **12-bit（当前）** | 结果 0~4095，精度最高              |
| **10-bit**         | 结果 0~1023，速度略快              |
| **8-bit**          | 结果 0~255，速度最快，适合简单场景 |

- **Enable FIFO Mode（启用硬件 FIFO）**
  - 勾选后 ADC 结果会推入 4-level 硬件 FIFO，而不是直接进 MEM 寄存器，适合突发高速采样。
  - 本工程未勾选，使用 MEM 寄存器 + DMA 的软件 FIFO 方案。
- **Power Down Scope（掉电作用域）**
  - Manual 掉电模式下，掉电指令影响范围：
    - **ADC Core only**：只关 ADC 核心，参考电路保持，再次唤醒更快
    - **ADC Core and Reference**：全部掉电，省电最多但唤醒最慢
- **Sample Time Preset 0 / 1（采样时间设置）**
  - 直接填入时长（如 `125us`），SysConfig 自动换算成 ADCCLK 周期数（4000 cycles @ 32 MHz）。
  - 采样时间越长，对高阻抗信号源越友好，但采样率降低。

## Interrupt Configuration（中断配置）

### Enable Interrupts（启用中断源）

unsigned short

| **可选中断**                   | **说明**                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| **DMA Done（当前）**           | DMA 搬运完 `transferSize` 个样本后触发，本工程用于通知主循环 |
| **MEM0 Result Loaded**         | 每次 MEM0 写入结果时触发，高频中断，CPU 负担重               |
| **Overflow**                   | MEMx 被写入时上一个结果尚未读走，发生溢出                    |
| **Window Comparator High/Low** | 窗口比较器阈值越界中断                                       |
| **Underflow**                  | DMA 读取 MEM 时结果还没准备好                                |

- **Interrupt Priority（中断优先级）**
  - 数值越小优先级越高。本工程 ADC 中断优先级 = **2**（DMA 全局中断也是 2，同级按进入顺序处理）。

## DMA Configuration（DMA 配置）

- **Configure DMA Trigger（配置 DMA 触发）**
  - 勾选后才会在下方展开 DMA Channel 子配置块，并在生成代码中产生 `SYSCFG_DL_DMA_ADC_init()`。

### Enable DMA Trigger（启用 DMA 触发源）

| **选项**                       | **说明**                                                 |
| ------------------------------ | -------------------------------------------------------- |
| **MEM0 Result Loaded（当前）** | MEM0 写入结果后触发 DMA，每次转换触发一次                |
| **MEM1~MEM7 Result Loaded**    | 对应 `sampCnt>1` 的多通道序列，等最后一个 MEM 写完才触发 |

## DMA Channel（DMA 通道配置）

- **Name（通道名）**
  - `DMA_ADC`，生成宏 `DMA_ADC_CHAN_ID`，代码中用此宏引用通道号，与具体分配到哪个物理通道解耦。

### Address Mode（地址模式）

| **选项**           | **含义**                                                     |
| ------------------ | ------------------------------------------------------------ |
| **Fixed to Block** | 源地址固定（ADC MEM0 寄存器），目标地址自动递增（写入 buf 数组） |
| **Block to Fixed** | 源地址递增，目标地址固定，用于 DAC：数组 → 固定寄存器        |
| **Block to Block** | 源和目标都递增，内存到内存搬运                               |
| **Fixed to Fixed** | 两端都固定，很少使用                                         |

### Source Length / Destination Length（数据宽度）

| **选项**                                | **说明**                              |
| --------------------------------------- | ------------------------------------- |
| **Byte (1 Byte)**                       | 8-bit 搬运                            |
| **Half Word (2 Bytes)（当前两端均选）** | 16-bit 搬运，匹配 `uint16_t` ADC 结果 |
| **Word (4 Bytes)**                      | 32-bit 搬运                           |

> 两端宽度必须与实际数据类型匹配，否则结果错位。

### Source Address Direction（源地址步进方式）

| **选项**                      | **说明**                                           |
| ----------------------------- | -------------------------------------------------- |
| **Unchanged / Fixed（当前）** | 每次 DMA 触发读同一地址（ADC MEM0 寄存器地址不变） |
| **Increment**                 | 每次触发后源地址 +2（Half Word），用于从数组读数据 |
| **Decrement**                 | 每次触发后源地址 -2                                |

- **Configure Transfer Size + Transfer Size（传输计数）**
  - 勾选后可手动输入 `transferSize`，本工程 = **16**。
  - DMA 完成 16 次触发（即 16 个样本）后停止并产生 `DMA_DONE` 中断。
  - 不勾选则由运行时 `DL_DMA_setTransferSize()` 动态设置。

### Transfer Mode（传输模式）

| **选项**                               | **说明**                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| **Single（默认，Basic Channel）**      | 每次触发搬 1 个单元；完成 `transferSize` 后通道停止，需手动 重装载dma |
| **Repeat Single（Full Channel 专属）** | 每次触发搬 1 个单元；完成 `transferSize` 后自动回绕，无限循环 |
| **Full（Full Channel 专属）**          | 每次触发搬完所有 `transferSize` 个单元                       |
| **Repeat Full（Full Channel 专属）**   | 同上，完成后自动回绕循环                                     |

> ADC DMA 分配在 `DMA_CH3`（Basic Channel），只能用 Single 模式，故此处无 Repeat 选项。

- **Enable Channel Interrupt / Enable Early Channel Interrupt**
  - **Enable Channel Interrupt**：`transferSize` 全部搬完后触发通道自身中断（独立于 ADC 的 `DMA_DONE` 中断）。
  - **Enable Early Channel Interrupt**：在 `transferSize/2` 处提前触发中断，用于 ping-pong 双缓冲。
  - 本工程两者均不勾选，依靠 ADC 侧的 `DL_ADC12_INTERRUPT_DMA_DONE` 通知。
- **PinMux — DMA Channel（物理通道分配）**
  - 本工程 = `DMA_CH3`（Basic Channel），原因：ADC 用 Single 模式不需要 Full Channel，CH0 留给 DAC 的 REPEAT 模式。

## Event Configuration（事件配置）

- **Event Publisher Channel ID / Event Subscriber Channel ID**
  - MSPM0G 的硬件事件总线（Event Fabric），允许外设之间无需 CPU 中转直接互相触发。
  - 例如：Timer CCR 事件 → ADC 开始采样；ADC 采样完成 → DAC 输出。
  - 本工程不使用事件总线，保持 `None / Disabled`。

## Pin Configuration（引脚配置）

- **ADC12 Analog Input Pin 3 → PA24**
  - PA24 固定为 ADC CH3 的模拟输入引脚。
  - 配置为模拟模式时，GPIO 数字功能自动禁用，无需额外设置上下拉电阻。

# DAC 配置

## 顶部标识

- **DAC12(0) / DAC0**
  - MSPM0G3507 只有一个 DAC12 外设（DAC0），不可更换。

## Quick Profiles（快速预设）

| **选项**                  | **说明**                     |
| ------------------------- | ---------------------------- |
| **Custom（当前）**        | 手动配置所有参数             |
| **Sine Wave via DMA**     | 预设正弦波 DMA 输出模板      |
| **Triangle Wave via DMA** | 预设三角波 DMA 输出模板      |
| **Output Static Value**   | 预设静态输出（直接写寄存器） |

> 选择预设后会自动填充常用参数组合，再手动微调。

## Basic Operation Configuration（基本运行配置）

- **Enable DAC（使能 DAC）**
  - 勾选后生成 `DL_DAC12_enable(DAC0)`，DAC 开始工作。不勾选则 DAC 上电但不输出。

### Positive Voltage Reference（正参考电压）

| **选项**                               | **说明**                             |
| -------------------------------------- | ------------------------------------ |
| **Positive reference is VDDA（当前）** | 以供电电压为正参考，简单，随电源波动 |
| **Positive reference is VREF+**        | 使用外部或内部精密基准，精度更高     |

> DAC 满量程输出电压 = 正参考 × (code / 4095)。本工程 VDDA = 3.3V，`code=4095` → 输出约 3.3V。

### Negative Voltage Reference（负参考电压）

| **选项**                               | **说明**                                  |
| -------------------------------------- | ----------------------------------------- |
| **Negative reference is VSSA（当前）** | 接地（0V），最常用                        |
| **Negative reference is VREF-**        | 使用外部负基准，可实现非 0 起点的输出范围 |

### Enable FIFO（启用硬件 FIFO）

| **状态**         | **效果**                                                     |
| ---------------- | ------------------------------------------------------------ |
| **勾选（当前）** | DAC 数据来自内部 8 槽 FIFO，由 FIFO Trigger Source 控制弹出节奏，适合 DMA 波形输出 |
| **不勾选**       | 数据直接由 `DL_DAC12_output12()` 写入 DATA0 寄存器，每写一次输出一次，适合静态或低速输出 |

### FIFO Trigger Source（FIFO 弹出触发源）

| **选项**                          | **说明**                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| **Sample time generator（当前）** | 由 DAC 内部采样定时器驱动，频率精确（本工程 1 MHz），无需外部时钟 |
| **Timer0 Event**                  | 由 TIMA/TIMB 的 CCR 事件触发，可与其他外设精确同步           |
| **Timer1 Event**                  | 同上，另一路 Timer                                           |
| **External Trigger**              | 外部引脚触发                                                 |

## DMA Configuration（DMA 配置）

- **Configure DMA Trigger（配置 DMA 触发）**
  - 勾选后生成 DMA 子块配置，并在生成代码中产生 `SYSCFG_DL_DMA_DAC_init()`。
- **Enable DMA Trigger（启用 DMA 触发）**
  - **勾选（当前）**：FIFO 达到阈值时向 DMA 发出请求，DMA 自动填充 FIFO。
  - **不勾选**：不使用 DMA，需 CPU 手动填写 FIFO。

## DMA Channel（DMA 通道配置）

- **Name（通道名）**
  - `DMA_DAC`，生成宏 `DMA_DAC_CHAN_ID`。
- **Channel ID（物理通道号，只读提示）**
  - 显示 0，并提示 *Currently using a Full Channel*。
  - 这是关键信息——只有 Full Channel（CH0/1/2）才能使用 `Repeat Single` 模式。

### Address Mode（地址模式）

| **选项**           | **说明**                                                 |
| ------------------ | -------------------------------------------------------- |
| **Fixed to Block** | 源固定，目标递增（ADC 用）                               |
| **Block to Fixed** | 源地址递增（遍历波表数组），目标固定（DAC DATA0 寄存器） |
| **另外两个**       | 参见 ADC 说明                                            |

- **Source Length（源数据宽度）**
  - `Half Word (2 Bytes)`，波表元素为 `uint16_t`，每次 DMA 取 2 字节。

### Source Address Direction（源地址步进）

| **选项**              | **说明**                                  |
| --------------------- | ----------------------------------------- |
| **Increment（当前）** | 每次触发后源地址 +2，顺序遍历整个波表数组 |
| **Fixed / Unchanged** | 源地址不动，重复读同一地址                |
| **Decrement**         | 倒序读取                                  |

- **Destination Length（目标数据宽度）**
  - `Half Word (2 Bytes)`，DAC DATA0 寄存器有效宽度 12-bit，用 16-bit 访问即可（高 4 bit 忽略）。
- **Configure Transfer Size + Transfer Size（传输计数）**
  - **1024**，对应波表长度。DMA 完成 1024 次触发（搬完整个波表）后，`Repeat Single` 模式自动回绕到波表起点，继续下一轮。

### Transfer Mode（传输模式）

| **选项**                  | **可用通道**      | **说明**                                                |
| ------------------------- | ----------------- | ------------------------------------------------------- |
| **Single**                | Basic + Full      | 完成 `transferSize` 后停止                              |
| **Repeat Single（当前）** | Full Channel 专属 | 每次触发搬 1 个，完成 1024 个后自动回到波表头，无限循环 |
| **Full**                  | Full Channel 专属 | 每次触发搬完全部 `transferSize` 个                      |
| **Repeat Full**           | Full Channel 专属 | Full 模式 + 自动回绕                                    |

> 这正是为什么 DAC DMA 必须用 `DMA_CH0`（Full Channel）的根本原因。

- **Enable Channel Interrupt / Enable Early Channel Interrupt**
  - 均不勾选。DMA 自动循环，不需要 CPU 介入，也不需要中断通知。

## FIFO Threshold（FIFO 触发阈值）

| **选项**                               | **含义**       | **空槽数** | **满槽数** | **DMA 响应余量** |
| -------------------------------------- | -------------- | ---------- | ---------- | ---------------- |
| **1/4 of locations are empty（当前）** | FIFO 有 1/4 空 | 2 槽空     | 6 槽满     | 6 µs             |
| **1/2 of locations are empty**         | FIFO 有 1/2 空 | 4 槽空     | 4 槽满     | 4 µs             |
| **3/4 of locations are empty**         | FIFO 有 3/4 空 | 6 槽空     | 2 槽满     | 2 µs             |

> 当前选择 `1/4 empty`：FIFO 还剩 6 槽数据（6 µs 的余量）就触发 DMA 补充 1 个点，最保守，DMA 响应余量最大，不易发生 FIFO 欠载（underrun）。

- **Enable Sample Time Generator（启用内部采样定时器）**
  - 勾选后 DAC 内部的采样定时器开始工作，按照 Sample Time Generator Rate 设定的频率定时从 FIFO 弹出数据送 DAC 核心。
  - 不勾选时需要外部 Timer 事件或软件触发 FIFO 弹出。

### Sample Time Generator Rate（采样定时器速率）

| **选项**           | **输出频率（1024点波表）** |
| ------------------ | -------------------------- |
| **500 kSPS**       | ≈ 488 Hz                   |
| **1 MSPS（当前）** | ≈ 976.6 Hz                 |
| **以此类推**       | —                          |

> 1 MHz 采样率，1024 点波表，输出频率 = 1,000,000 / 1024 ≈ 976.6 Hz。

- **Enable DAC Output（使使能 DAC 输出引脚）**
  - 勾选后 PA15 引脚连接到 DAC 模拟输出，未勾选则 PA15 保持高阻态。
- **Default DAC Value (12-Bit)（初始 DAC 值）**
  - **0（当前）**，DAC 使能后初始输出 0V。
  - 若此处填入非零值（如 2048），SysConfig 会生成 `DL_DAC12_output12(DAC0, 2048)`，这条调用绕过 FIFO 直接写寄存器，会干扰 DMA+FIFO 波形输出，必须保持 0。

## Advanced Configuration（高级配置）

### Output Resolution（输出精度）

| **选项**                      | **说明**                                                  |
| ----------------------------- | --------------------------------------------------------- |
| **12-bit resolution（当前）** | 结果范围 0~4095，精度最高，DAC 输出步进约 0.8 mV（@3.3V） |
| **8-bit resolution**          | 结果范围 0~255，写 DATA0 时只用低 8 位，适合低精度场景    |

### Input Data Format（输入数据格式）

| **选项**                          | **说明**                                        |
| --------------------------------- | ----------------------------------------------- |
| **Binary representation（当前）** | 无符号整数，0=0V，4095=VDDA，最常用             |
| **Twos complement**               | 补码有符号，-2048 ~ +2047，适合差分或双极性输出 |

### DAC And Output Amplifier（输出放大器）

| **选项**                                     | **说明**                                                     |
| -------------------------------------------- | ------------------------------------------------------------ |
| **Output and Input amplifiers on（当前）**   | 输入缓冲+输出放大器全开，驱动能力强（可驱动低阻负载），电流消耗约 300~500 µA |
| **Output amplifier on, Input amplifier off** | 仅输出放大器，驱动能力稍弱，省电                             |
| **Both amplifiers off**                      | 全关，直接输出 DAC 核心电压，高阻态输出，只能接高阻抗负载    |

## Interrupt Configuration（中断配置）

- **Enable Interrupts：None**
  - DAC 输出由 DMA 全自动驱动，无需任何中断通知，CPU 零参与。
  - 可用的中断源包括：`FIFO Empty`（FIFO 完全空，发生 underrun 时）、`FIFO 1/4、1/2、3/4` 阈值中断等，调试时可临时启用 `FIFO Empty` 来检测是否发生欠载。

## Event Configuration（事件配置）

- **Enable Publisher Events / Event 0 Subscriber Channel ID**
  - 同 ADC 说明，本工程不使用事件总线。
  - DAC 可以发布"转换完成"事件，让其他外设（如 ADC）同步采样；也可以订阅 Timer 事件来精确控制 FIFO 弹出节奏。本工程用内部采样定时器，不需要事件总线。

## Pin Configuration（引脚配置）

### IO Structure（IO 结构类型）

| **选项**             | **说明**                                            |
| -------------------- | --------------------------------------------------- |
| **Standard（当前）** | 标准 CMOS 输出，适合通用场景                        |
| **High-Drive**       | 更强驱动电流（最大 20 mA），适合直接驱动 LED 等负载 |
| **Open Drain**       | 开漏输出，需外部上拉，适合 I2C 等总线               |

## DAC 波形 DMA 输出

### 工作原理

```
Flash (dac_wave[1024])
      │
      │  DMA_CH0
      │  FULL_CH_REPEAT_SINGLE
      ▼
DAC12 FIFO (8槽)  ──触发──► DAC12 内部采样定时器 (1 MHz)
      │
      ▼
PA15 模拟输出
```

- DAC 内部采样定时器以 **1 MHz** 速率从 FIFO 弹出数据并转换输出
- FIFO 剩余 **≤ 2 槽**（ONE_QTR_EMPTY）时触发 DMA，DMA 搬一个 `uint16_t` 进 FIFO
- DMA 用 `FULL_CH_REPEAT_SINGLE` 模式：每次触发搬 1 个字，搬满 1024 个后自动回绕到数组头部
- 输出频率 = 1 000 000 / 1024 ≈ **976.6 Hz**

> **为什么必须用 DMA_CH0？**  
> MSPM0G3507 的 DMA_CH0/1/2 为 **Full Channel**，支持 `FULL_CH_REPEAT_SINGLE`。  
> DMA_CH3~6 为 **Basic Channel**，只支持单次传输，不能做循环波形。

### dac_timer.c 关键 API

```c
// ① 设置 DMA 源地址（波表首地址）
DL_DMA_setSrcAddr(DMA, DMA_DAC_CHAN_ID, (uint32_t)&dac_wave[0]);
//   参数1: DMA 外设基址（固定写 DMA）
//   参数2: 通道 ID，由 SysConfig 的 $name="DMA_DAC" 生成宏 DMA_DAC_CHAN_ID
//   参数3: 源地址，波表数组首地址

// ② 设置 DMA 目标地址（DAC DATA0 寄存器）
DL_DMA_setDestAddr(DMA, DMA_DAC_CHAN_ID, (uint32_t)&DAC0->DATA0);
//   DAC0->DATA0 是 DAC12 的输入数据寄存器（16 bit，高 4 bit 忽略）

// ③ 使能 DMA 通道，此后全程自动运行，无需 CPU 干预
DL_DMA_enableChannel(DMA, DMA_DAC_CHAN_ID);
```

> **不需要调用 `DL_DMA_setTransferSize()`**  
> SysConfig 生成的 `SYSCFG_DL_DMA_DAC_init()` 已在 `initChannel()` 前调用过  
> `DL_DMA_setTransferSize(DMA, DMA_DAC_CHAN_ID, 1024)`。  
> 若在 `initChannel()` 之后再次调用 `setTransferSize()`，会破坏  
> `FULL_CH_REPEAT_SINGLE` 的内部回绕计数器，导致波形错乱。

###  波形切换

在 `dac_timer.c` 顶部修改宏即可，无需改其他文件：

```c
#define DAC_WAVE_SINE     0   // 正弦波，1024点，2048±2047
#define DAC_WAVE_SQUARE   1   // 方波，50%占空比，0/4095
#define DAC_WAVE_TRIANGLE 2   // 三角波，0→4095→0

#define DAC_WAVE_MODE  DAC_WAVE_TRIANGLE   // ← 改这里
```

| 波形     | 描述                                   | 幅值     |
| -------- | -------------------------------------- | -------- |
| SINE     | 标准正弦，中心 2048                    | 0 ~ 4095 |
| SQUARE   | 前 512 点 = 4095，后 512 点 = 0        | 0 / 4095 |
| TRIANGLE | 0 → 4095（前 512），4095 → 0（后 512） | 0 ~ 4095 |

输出频率均为 **976.6 Hz**（1 MHz / 1024 点）。

---

##  ADC12 — 单通道 DMA 采集

###  工作原理

```#
PA24 (AIN3)
  │
  ▼
ADC12  连续转换 (REPEAT)，自动触发
  │  每完成一次转换 → MEM0_RESULT_LOADED → 触发 DMA
  │
  │  DMA_CH3
  │  SINGLE 模式，每次搬 1 个 uint16_t
  ▼
adc_dma_buf[16]（环形缓冲，满 16 个触发中断）
  │
  ▼
ADC12_INT_IRQHandler → DMA_DONE 中断 → 业务处理
```

# 什么是MEM0

在 MSPM0 的硬件架构中，**`MEM0`** 是指 **ADC12（12位模数转换器）外设内部的“转换结果存储寄存器 0”（Conversion Memory Register 0）**。

### ADC12 的多寄存器缓冲架构

传统的低端 MCU，其 ADC 通常只有一个全局的 `DATA` 寄存器，每次转换完成都会覆盖前一次的值。而 MSPM0 的 ADC12 外设引入了**多结果寄存器队列架构**（通常包含 `MEM0` 到 `MEM11` 多个独立的存储单元）。

这种设计带来了两个关键的硬件优势：

- **序列采样（Sequence Mode）：** 可以配置 ADC 自动连续采样多个不同的通道（例如：通道 1 存入 `MEM0`，通道 2 存入 `MEM1`，通道 3 存入 `MEM2`），中途不需要 CPU 或 DMA 介入切换通道。
- **循环单通道（Repeat Single-Channel Mode）：** 如果只配置了一个通道但开启了 `REPEAT` 模式（如你当前的代码场景），ADC 会将每一次的转换结果都固定锁存进 **`MEM0`** 中。

### `MEM0` 在硬件联动中的核心角色

在底层的信号流转中，`MEM0` 不仅仅是一个静态的存储单元，它还是一个**硬件事件发生器**。

整个硬件联动（ADC -> DMA）的时序逻辑如下：

1. **转换完成与加载：** ADC 核心（内核）完成模拟量到数字量的转换后，硬件逻辑自动将这 12 位的数字结果写入 `MEM0` 寄存器。
2. **触发硬件事件：** 当数据被成功锁存进 `MEM0` 的瞬间，硬件内部会立刻产生一个高电平脉冲，即 **`MEM0_RESULT_LOADED`（MEM0结果已加载事件）**。
3. **驱动 DMA 搬运：**  这个事件通过片内的事件总线直接硬连线连接到预先配置好的 DMA 通道的触发输入端。
   - DMA 控制器接收到这个 `MEM0_RESULT_LOADED` 信号后，立刻启动一次传输总线周期（，直接前往 `MEM0` 寄存器的物理地址，将里面的数据读出，并写入你定义的内存缓冲区 `adc_dma_buf`。

> **DMA Samples Count 与 MEM 寄存器的关系（重要）**
>
> `DMA Samples Count = N` 表示 ADC 每次序列转换使用 MEM0 ~ MEM(N-1)，  
> 每个 MEM 寄存器都必须在 SysConfig 中配置输入通道。  
>    `DMA Samples Count = 1` → 只用 MEM0，最简单，适合单通道连续采集。  
>    `DMA Samples Count = 8` → 需要 adcMem0~adcMem7chansel 全部配置，否则序列卡住，DMA 永不触发。



### DMA_DONE 中断处理

```c
// 在 adc_app.c 中的中断处理（示意）
void ADC12_0_INST_IRQHandler(void)
{
    switch (DL_ADC12_getPendingInterrupt(ADC12_0_INST)) {
    case DL_ADC12_IIDX_DMA_DONE:
        // DMA 已将 16 个样本搬到 adc_dma_buf
        // 此处将数据写入环形缓冲区 adc_rb
        break;
    default:
        break;
    }
}
```

---

## ADC 实现流程

### 数据流总览

```
PA24 (AIN3)
  │ 模拟输入
  ▼
ADC12 (REPEAT, AUTO, 125µs/sample)
  │ 每次转换完成 → MEM0_RESULT_LOADED → 触发 DMA_CH3
  ▼
DMA_CH3 (SINGLE 模式)
  │ 搬 1 个 uint16_t：ADC MEM0 → adc_dma_buf[当前位置]
  │ 搬满 16 个后 → DMA_DONE → 触发 ADC12_0_INST_IRQHandler
  ▼
ADC12_0_INST_IRQHandler（优先级 2）
  │ ① 把 adc_dma_buf[16] 整块写入 adc_rb（环形缓冲）
  │ ② 重新配置并使能 DMA，准备接收下一批 16 个样本
  ▼
adc_rb（256 × uint16_t 软件环形缓冲）
  │ 主循环轮询读取
  ▼
adc_dac_task()
  │ 逐个取出，保留最新值
  ▼
my_printf → UART 输出 
```

---

### 关键数据结构

```c
#define ADC_DMA_SAMPLES  16U     // DMA 每批搬运的样本数，也是 DMA transferSize
#define ADC_RB_SAMPLES   256U    // 环形缓冲容量（以样本数计）
#define ADC_VREF_MV      3300U   // 参考电压 3.3V，用于换算 mV

static uint16_t adc_dma_buf[ADC_DMA_SAMPLES];          // DMA 落点，16×uint16_t = 32 字节
static struct rt_ringbuffer adc_rb;                     // RT-Thread 环形缓冲控制块
static rt_uint8_t adc_rb_pool[ADC_RB_SAMPLES * sizeof(uint16_t)]; // 512 字节池
```

| 缓冲层        | 大小             | 作用                           |
| ------------- | ---------------- | ------------------------------ |
| `adc_dma_buf` | 16 样本 = 32 B   | DMA 的直接写入目标，中断里读取 |
| `adc_rb`      | 256 样本 = 512 B | 中断→任务的异步队列，防止丢帧  |

---

### `adc_dma_start()` — DMA 重配函数

```c
static void adc_dma_start(void)
{
    // ① 先禁用通道，防止重配期间产生错误传输
    DL_DMA_disableChannel(DMA, DMA_ADC_CHAN_ID);

    // ② 源地址：ADC MEM0 结果寄存器的物理地址
    //    DL_ADC12_getMemResultAddress() 返回 ADC12_0->MEMRES[0] 的地址
    //    固定不变，每次转换结果都写到这里
    DL_DMA_setSrcAddr(
        DMA, DMA_ADC_CHAN_ID,
        DL_ADC12_getMemResultAddress(ADC12_0_INST, DL_ADC12_MEM_IDX_0));

    // ③ 目标地址：每次重新指向 adc_dma_buf[0]
    //    DMA 以 INCREMENT 模式自动向后移动，填满 16 个槽后停止（SINGLE 模式）
    DL_DMA_setDestAddr(
        DMA, DMA_ADC_CHAN_ID,
        (uint32_t)&adc_dma_buf[0]);

    // ④ 传输计数：16 次（对应 ADC_DMA_SAMPLES）
    //    Basic Channel 的 SINGLE 模式：每次触发搬 1 个，搬完 16 个后产生 DMA_DONE
    //    注意：DAC DMA（Full Channel）在 initChannel 后不能再调 setTransferSize；
    //          ADC DMA（Basic Channel / SINGLE）每次 re-arm 都必须重新设置，否则计数不会恢复
    DL_DMA_setTransferSize(DMA, DMA_ADC_CHAN_ID, ADC_DMA_SAMPLES);

    // ⑤ 重新使能通道，等待下一次 ADC 触发
    DL_DMA_enableChannel(DMA, DMA_ADC_CHAN_ID);
}
```

> **为什么 ADC DMA 每次中断后都要调 `adc_dma_start()`？**
>
> ADC 使用 **Basic Channel（DMA_CH3）+ SINGLE 模式**。  
>    SINGLE 模式传输完成后通道自动停止，计数归零，目标地址停在末尾。  
> 若不重新 `disableChannel → setSrcAddr → setDestAddr → setTransferSize → enableChannel`，  
> 下一批 ADC 数据无处可去，等于丢弃。  
>
> 对比 DAC DMA（Full Channel + FULL_CH_REPEAT_SINGLE）：传输完 1024 个后自动回绕地址和计数，**无需任何 CPU 干预**。

---

### `adc_dac_init()` — 初始化顺序

```c
void adc_dac_init(void)
{
    // ① DAC DMA 配置（src/dst/enable），波形立即开始输出
    dac_timer_init();

    // ② 初始化软件环形缓冲
    //    pool 大小 = 256 × 2 = 512 字节，rt_ringbuffer 按字节管理
    rt_ringbuffer_init(&adc_rb, adc_rb_pool, sizeof(adc_rb_pool));

    // ③ 配置 ADC DMA 并使能，等待第一次 ADC 转换触发
    adc_dma_start();

    // ④ 清除 NVIC 中可能残留的 ADC 中断挂起位，避免虚假触发
    NVIC_ClearPendingIRQ(ADC12_0_INST_INT_IRQN);
    NVIC_EnableIRQ(ADC12_0_INST_INT_IRQN);

    // ⑤ 使能 ADC 转换序列（SysConfig init 里已调用，这里是防御性重调）
    DL_ADC12_enableConversions(ADC12_0_INST);

    // ⑥ 软件触发第一次转换，之后 ADC 以 REPEAT 模式自动循环
    DL_ADC12_startConversion(ADC12_0_INST);
}
```

> `DL_ADC12_startConversion()` 只需调用一次。  
> ADC 配置为 `REPEAT_MODE_ENABLED + SAMPLING_SOURCE_AUTO`，  
> 第一次转换完成后自动启动下一次，无需再触发。

---

### `ADC12_0_INST_IRQHandler()` — 中断处理

```c
void ADC12_0_INST_IRQHandler(void)
{
    switch (DL_ADC12_getPendingInterrupt(ADC12_0_INST)) {
    case DL_ADC12_IIDX_DMA_DONE:
        // 此时 DMA 已将 16 个 uint16_t 搬入 adc_dma_buf[0..15]
        // ADC 仍在后台继续转换（REPEAT 模式），但 DMA 已停止（SINGLE 完成）

        // ① 检查环形缓冲剩余空间是否够放一整批（32 字节）
        //    不够则丢弃本批，保护 ringbuffer 不溢出
        if (rt_ringbuffer_space_len(&adc_rb) >= sizeof(adc_dma_buf)) {
            rt_ringbuffer_put(
                &adc_rb,
                (const rt_uint8_t *)adc_dma_buf,  // 强转为字节指针
                sizeof(adc_dma_buf));              // 32 字节整批写入
        }

        // ② 立刻重新装载 DMA，接收接下来的 16 个样本
        //    此调用在中断里执行，耗时极短（5 次寄存器写）
        //    ADC 继续转换，下次 MEM0_RESULT_LOADED 触发时 DMA 已就绪
        adc_dma_start();
        break;

    default:
        break;
    }
}
```

**时序关键点：**

```
ADC 转换周期 ≈ 125 µs

第 1 次转换完 → DMA 搬 →  adc_dma_buf[0]
第 2 次转换完 → DMA 搬 →  adc_dma_buf[1]
...
第16 次转换完 → DMA 搬 →  adc_dma_buf[15] → DMA_DONE 中断
                                              ├─ put 32字节到 adc_rb
                                              └─ 重新装载 DMA（< 1µs）
第17 次转换完 → DMA 搬 →  adc_dma_buf[0]   ← DMA 已就绪，无漏采
```

每批 16 个样本 = 16 × 125 µs = **2 ms** 一次中断，中断负载极低。

---

### `adc_dac_task()` — 主循环任务

```c
void adc_dac_task(void)
{
    uint16_t raw;
    uint16_t latest = 0U;
    uint32_t mv;
    bool has_data = false;

    // ① 把 adc_rb 中所有已有数据全部取出，只保留最新一个
    //    rt_ringbuffer_get 每次取 sizeof(raw)=2 字节，返回实际取到的字节数
    //    循环直到缓冲为空，避免 rb 积压
    while (rt_ringbuffer_get(
               &adc_rb,
               (rt_uint8_t *)&raw,
               sizeof(raw)) == sizeof(raw)) {
        latest = raw;       // 覆盖更新，只留最新值
        has_data = true;
    }

    // ② 若本次调用期间没有新数据，直接返回不打印
    if (!has_data) {
        return;
    }

    // ③ 12-bit ADC 转 mV：
    //    mv = raw × 3300 / 4095
    //    加 2047 是为了四舍五入（整数除法向上取整）
    //    3300 × 4095 = 13,513,500，不超过 uint32_t 上限（42亿），安全
    mv = ((uint32_t)latest * ADC_VREF_MV + 2047U) / 4095U;

    my_printf(UART_0_INST,
        "ADC=%u, Voltage=%lu mV\r\n",
        latest,
        (unsigned long)mv);
}
```

- **取整方式**：`(raw × 3300 + 2047) / 4095`  
  等价于 `round(raw × 3300 / 4095)`，比直接整除误差小 0.5 LSB。

---

### 缓冲层设计与溢出保护

```
ADC 采集速率：125µs 
DMA 批次大小：16 样本 → 每 2ms 一次中断
rb 容量：      256 样本 → 可缓冲 32 ms 的数据

主循环调用 adc_dac_task() 的最大允许间隔：
  rb 满载时间 = 256 / 125µs = 32 ms
  → 主循环间隔必须 < 32 ms，否则 rb 溢出，中断里整批丢弃
```

溢出保护机制（中断里的 if 判断）：

```c
// 剩余空间不足一批（32字节）→ 丢弃本批，不写入破坏已有数据
 if (rt_ringbuffer_space_len(&adc_rb) >= sizeof(adc_dma_buf)) {
            rt_ringbuffer_put(
                &adc_rb,
                (const rt_uint8_t *)adc_dma_buf,
                sizeof(adc_dma_buf));
        }
```

> 丢弃整批（16个）而不是部分写入，保证 rb 中始终是完整批次对齐的数据，  
> 避免 `adc_dac_task` 取到半批导致数据错位。

## DMA 通道资源总表

| 通道    | 类型  | $name   | 使用者         | 传输模式              | 触发源                 |
| ------- | ----- | ------- | -------------- | --------------------- | ---------------------- |
| DMA_CH0 | Full  | DMA_DAC | DAC12 FIFO     | FULL_CH_REPEAT_SINGLE | DAC12_FIFO_THRESH      |
| DMA_CH1 | Full  | DMA_CH1 | UART_JY901S RX | FULL_CH_REPEAT_SINGLE | UART RX                |
| DMA_CH2 | Full  | DMA_CH0 | UART_0 RX      | FULL_CH_REPEAT_SINGLE | UART RX                |
| DMA_CH3 | Basic | DMA_ADC | ADC12 MEM0     | SINGLE                | ADC MEM0_RESULT_LOADED |

> **Full Channel（CH0/1/2）**：支持 REPEAT 模式，传输完后自动回绕地址和计数，  
> 适合循环 DMA（波形输出、UART 环形接收）。  
>    **Basic Channel（CH3~6）**：仅支持单次传输，每次传输结束需外部重新触发，  
> 适合"每次中断搬一次"的场景（ADC 单点采集）。

---

##  ADC 硬件 FIFO 说明

ADC12 的"硬件 FIFO"实际上是**多 MEM 顺序转换**，不是独立的 FIFO 存储器。

```
DMA Samples Count = N  →  ADC 做 N 次连续转换
                结果依次存入 MEM0 → MEM1 → ... → MEM(N-1)
                MEM(N-1) 写入后触发 DMA
```

若想用 `DMA Samples Count`（8 个样本一次 DMA），必须在 SysConfig 中配置全部 8 个 MEM：

**选择 `DMA Samples Count = 1` 的原因：**  

- 只有一个 ADC 通道，不需要多通道扫描
- `adc_app.c` 已有软件环形缓冲（`adc_rb`），DMA 搬满 16 个触发中断，功能等价

# MSPM0 定时器外设分类

#### TIMG (General Purpose Timer - 通用定时器)

TIMG 是标准数字定时器模块，提供 16 位或 32 位的计数器分辨率（视具体型号结尾而定，如 TIMG0 可能是 32 位）。

- **核心功能：** 支持向上、向下、中心对齐（Up/Down/Up-Down）计数模式。包含多个捕获/比较（Capture/Compare, CC）通道。
- **主要应用：**
  - 产生周期性系统中断（Timebase Tick）。
  - 硬件延时基准。
  - 基础的边缘捕获（Input Capture）和标准脉宽调制信号（PWM）生成。
  - 通过内部事件总线（Event Fabric）作为其他外设（如 ADC、DMA）的硬件触发源。

#### TIMA (Advanced Timer - 高级定时器)

TIMA 是在 TIMG 架构基础上的功能超集，专为电力电子控制、多相电机驱动等高可靠性、高精度要求的工业应用设计。

- **增强型硬件特性：**
  - **死区发生器 (Dead-Band Insertion, DBI)：** 硬件自动在互补输出的 PWM 信号间插入死区时间，防止半桥/全桥电路的上下管直通短路。
  - **硬件故障处理 (Fault Handling)：** 具备专用故障输入接口，当检测到外部过流或过压信号时，可绕过 CPU 纯硬件级瞬间封锁 PWM 输出，确保系统安全。
  - **正交编码器接口 (QEI) 支持：** 部分 TIMA 模块支持硬件解析电机编码器的 A/B/Z 相信号。
  - **高级同步：** 多个 TIMA 模块之间支持极高精度的相位同步和交叉触发。



# 定时器 (Timer) 中断事件

我们在 SysConfig 中看到的这些带有 `event`（事件）字眼的选项，代表了定时器在运行过程中可能发生的各种“关键时刻”。

当你勾选了某个选项，就意味着：**当这个时刻发生时，单片机会立刻放下手里正在做的事，去执行你写的对应的中断服务函数 (Interrupt Service Routine)。**

我们可以把这些事件分为三大类来理解：

## 基础计步事件 (与定时器的主计数器有关)

定时器本质上就是一个不断数数的机器（比如从 0 数到 1000，或者从 1000 倒数到 0）。

-  **Zero event (归零事件)：**
  - **大白话：** 倒数计时到 `0` 的那一瞬间。
  - **生活场景：** 就像微波炉加热倒计时，从 30 秒数到 0 秒时，“叮”地响一声。
  - **应用：** 这是**最常用**的定时中断。比如你想让 LED 灯每隔 1 秒闪烁一次，或者每隔 1 毫秒去读取一次传感器，通常就是勾选这个，让定时器每次数到 0 就触发一次中断。
-  **Load event (装载/满载事件)：**
  - **大白话：** 计数器数到了你设定的最大值（Load 值），或者重新装载初始值的那一瞬间。
  - **生活场景：** 想象一个水桶（计数器）接水，水正好接满到你画的刻度线的那一刻。

## 比较事件 (与 PWM 或特定时间点有关)

定时器不仅能数到头才提醒，还能在中间的特定时刻提醒。这就涉及到了“通道 (Channel)”和“比较 (Compare)”。 想象定时器是一个从 0 走到 100 的刻度尺，你可以在 30 的位置放一个“比较标记 (Compare Value)”。

-  **Channel X compare up event (通道X向上比较事件)：**
  - **大白话：** 定时器在**从小到大**数数（0, 1, 2...）的过程中，正好数到了你设定的标记点（比如30）的那一瞬间。
-  **Channel X compare down event (通道X向下比较事件)：**
  - **大白话：** 定时器在**从大到小**倒数（100, 99...）的过程中，正好路过你的标记点（比如30）的那一瞬间。
  - **应用 (敲黑板！这个和 ADC 息息相关)：** 在做电机控制或高级电源时，我们通常使用“中央对齐”模式（0数到100，再从100数到0）。这个时候生成的是 PWM 波（用来控制电机转速）。我们经常会在 `compare up` 或 `compare down` 的瞬间，**让定时器自动去触发 ADC 进行采样**。因为这个时候电路最稳定，测出来的电流/电压最准！这就是上一节提到的“模拟外设联动”。

## 异常与其它事件

-  **Trigger Overflow event (触发溢出事件)：**
  - **大白话：** “我都快忙不过来了！” 定时器收到了太多的外部触发信号，上一个还没处理完，下一个又来了，导致丢失了信号。通常用于故障排查。
-  **Fault event (故障事件)：**
  - **大白话：** 发生了硬件级别的故障。比如电机驱动芯片报错，引脚检测到短路等，用来紧急关断定时器输出，保护电路。

### 定时器外设与物理引脚（GPIO）的映射关系

关于“是否占用引脚”，需理解 MCU 的 **内部总线架构** 与 **引脚复用矩阵（Pin Multiplexing, PinMux）** 之间的隔离设计。定时器作为内部硅核上的纯数字电路，其自身运行不依赖任何外部物理引脚，引脚占用取决于**信号路由的终点**。

具体分为以下两种物理状态：

#### 状态 1：无引脚占用（内部闭环运行）

当定时器的信号流转仅在 MCU 核心逻辑内部发生时，不会激活外围的 PinMux 模块，此时**完全不占用任何 GPIO 引脚**。

- **中断模式：** 定时器达到计数值（Load/Zero/CC Match），向嵌套向量中断控制器（NVIC）发送中断请求信号（IRQ），CPU 响应并执行 ISR（中断服务函数）。
- **事件联动（Event Fabric）：** 定时器产生的周期信号被直接路由到内部的事件路由器，触发片内其他模块。例如：Timer CCR0 事件直接通过内部硬连线启动 ADC 的转换模块。在这个数据路径中，信号不需要输出到芯片外部，因此不涉及 GPIO 分配。

#### 状态 2：占用引脚（外部信号交互）

当定时器需要采集外部物理世界的电平，或将内部生成的电平变化驱动到外部电路时，必须打通外设到物理 Pad 的连接，此时**必须占用 GPIO 引脚**。

- **输出比较 / PWM 模式：** 定时器的 CC（比较）通道生成的数字波形，需通过 PinMux 矩阵映射到特定的物理引脚（如 PA0）。此时 PA0 被配置为“外设功能（Peripheral Function）”，丧失通用数字输入/输出的能力。
- **输入捕获 / 外部时钟模式：** 需要将外部的脉冲信号引入 MCU，同样需要配置 PinMux，将某个 GPIO 的输入缓冲器（Input Buffer）直接路由至定时器的 CC（捕获）通道或外部时钟输入端。