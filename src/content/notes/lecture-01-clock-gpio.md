

# 米醋电子工作室-TI M0系列 第一讲 时钟&调度器&GPIO

## DL库

**DL库** 是 TI 的 **DriverLib（驱动程序库）**，代码中的函数和宏全都是以 `DL_` 开头（例如 `DL_GPIO_initPeripheral`）。

## HAL库

**HAL库** 是 ST 的 **Hardware Abstraction Layer（硬件抽象层库）**，函数以 `HAL_` 开头（例如 `HAL_GPIO_Init`）。

## 核心区别

| **特性维度**       | **TI 的 DL库 (DriverLib)**               | **ST 的 HAL库 (Hardware Abstraction Layer)**   |
| ------------------ | ---------------------------------------- | ---------------------------------------------- |
| **出品厂商**       | TI (德州仪器)                            | ST (意法半导体)                                |
| **主流代表芯片**   | MSPM0系列（如 M0G3507）、TM4C、MSP432    | STM32全系列（如 F1、F4、H7、G0 等）            |
| **函数名前缀**     | `DL_` (如 `DL_UART_transmitData`)        | `HAL_` (如 `HAL_UART_Transmit`)                |
| **抽象层级**       | **中低层**（本质是寄存器的“语义化包装”） | **高层**（封装了完整的状态机和业务逻辑）       |
| **代码体积与效率** | **极高、极轻量**。几乎没有额外开销       | **臃肿、效率较低**。内部包含大量状态检查与断言 |
| **对标ST的库**     | 相当于 STM32 的 **LL库**（Low Layer）    | 无直接对应（TI 另外有高层的 TI Drivers 库）    |
| **图形配置工具**   | TI SysConfig                             | STM32CubeMX                                    |

## 深度对比

### 抽象层级：DL库是“纯粹的助手”，HAL库是“严厉的管家”

这是两者最大的区别。

- **HAL库（高层抽象）：** ST 的初衷是让你“忘记底层硬件”。为了做到跨芯片移植，HAL库内部设计了非常庞大的结构体（如句柄 `UART_HandleTypeDef`）。它不仅帮你配置寄存器，还**帮你接管了软件业务逻辑**。比如你调用串口中断接收函数，它会自己去管中断、传缓冲区、计数，等收满了字节才触发你写的 `HAL_UART_RxCpltCallback` 回调函数。
- **DL库（低层驱动）：** TI 的设计理念是“用人类看得懂的函数代替枯燥的寄存器数值”。它几乎不夹带任何软件层面的私货。你调用 `DL_UART_init`，它就老老实实把寄存器配好，然后就收手了。它不会帮你管什么接收缓冲区，也不会帮你托管中断流。你需要自己去写硬件中断服务函数（ISR），在里面用 `DL_UART_receiveData` 挨个字节自己捞。

###  执行效率与内存占用：DL库完胜

由于 HAL库 为了兼顾通用性和安全性，在每个函数内部都加了大量的参数检查（Assert）、状态锁定（Lock）和状态机切换，这导致它的**执行效率相对较低，生成的代码体积很大**。

而 DL库 的代码非常精简，许多函数内部只有一两行直接操作寄存器的代码，甚至被做成了内联函数（inline）。它的运行效率几乎和直接写寄存器一样快，对 Flash 和 RAM 的占用极小。对于存储资源本身就比较紧张的 Cortex-M0+ 芯片来说，DL库非常轻量高效。

###  图形化开发生态

两套库现在都高度依赖图形化配置工具，这也是现代 MCU 开发的趋势：

- **DL库 搭配 TI SysConfig：** 通过图形界面配置引脚、时钟树和外设参数，SysConfig 会自动生成 `ti_msp_dl_config.c` 和 `.h` 文件，里面全都是自动帮你写好的 `SYSCFG_DL_init()` 及其子函数。
- **HAL库 搭配 STM32CubeMX：** 同样是图形化配置时钟和外设，一键生成初始化代码，并且能直接生成适配各种 IDE（Keil、IAR、CubeIDE）的完整工程。

## STM32F4 & MSPM0 对比

STM32F407VET6 属于 STMicroelectronics STM32F4 系列，内核为 **Arm Cortex-M4F**，面向较高主频、较强运算能力、较丰富高速外设的通用控制场景。典型应用包括电机控制、通信网关、工业控制、人机交互、音频处理、数据采集与较复杂的嵌入式应用。

MSPM0G3507 属于 Texas Instruments MSPM0 G 系列，内核为 **Arm Cortex-M0+**，面向低成本、低功耗、混合信号采集和中低复杂度控制场景。典型应用包括传感器采集、低功耗控制器、简单电机控制、仪表、按键显示控制、串口通信节点和教学实验平台。

两者均为 32 位 Arm Cortex-M 微控制器，但产品定位不同。STM32F407VET6 更接近高性能通用 MCU，MSPM0G3507 更接近低功耗混合信号 MCU。

## 核心参数对比

| 对比项目 |                           STM32F407VET6 |                                    MSPM0G3507 |
| -------- | --------------------------------------: | --------------------------------------------: |
| 厂商     |                      STMicroelectronics |                             Texas Instruments |
| 系列     |                                 STM32F4 |                                        MSPM0G |
| CPU 内核 |                          Arm Cortex-M4F |                                Arm Cortex-M0+ |
| 最高主频 |                                 168 MHz |                                        80 MHz |
| Flash    |                                  512 KB |                                        128 KB |
| SRAM     | 192 KB 主 SRAM 级别，另有备份 SRAM 资源 |                                         32 KB |
| 硬件浮点 |                          支持单精度 FPU |                                不支持硬件 FPU |
| DSP 指令 |                                    支持 |                   不支持 Cortex-M4 DSP 指令集 |
| 数学加速 |                         FPU 与 DSP 指令 |                            MATHACL 数学加速器 |
| 典型封装 |                                 LQFP100 |                多种封装，常见 LQFP/VQFN/VSSOP |
| 工作电压 |                       约 1.8 V 到 3.6 V |                            约 1.62 V 到 3.6 V |
| 开发工具 |    STM32CubeMX、STM32CubeIDE、Keil、IAR | TI SysConfig、Code Composer Studio、Keil、IAR |

[单片机的这个值不同，速度可能相差10几倍！时钟周期和机器周期最本质区别，3分钟搞懂！_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1QQ4y1V7A3/?spm_id_from=333.337.search-card.all.click&vd_source=b092ebd8a65ddb68599cdfb641a4934a)

## 时钟系统配置

在 TI MSPM0 的设计里，时钟系统大致分为两层：**“发电机”（时钟源）** 和 **“用电网络”（时钟信号）**。

### 第一层：三大“发电机”（时钟源 - 谁在产生脉冲？）

所有的时钟信号，最初都来自底层的物理振荡器。

- **SYSOSC (System Oscillator - 主力发电机组) 系统振荡器**
  - **频率**：可调（通常是 32MHz、40MHz 甚至 80MHz，取决于你用的 G 系列还是 L 系列）。
  - **比喻**：工厂里的**大型柴油发电机**。启动极快，动力强劲，是整个单片机最核心的动力来源。MSPM0 的一大卖点就是这个内部发电机极其精准，很多时候你根本不需要外接晶振。
- **LFOSC (Low-Frequency Oscillator - 备用纽扣电池) 低频振荡器**
  - **频率**：固定 32.768 kHz。
  - **比喻**：工厂配电箱里内置的**长寿命备用电池**。极其省电，永远在线。
- **HFXT / LFXT (External Crystals - 外部精密电网) 外部晶振**
  - **频率**：你外接的晶振频率（高频或低频）。
  - **比喻**：**国家电网**。如果你做的项目对时间要求苛刻到变态（比如高精度仪表），内部发电机不够用了，你就得花钱外接晶振，引入更精准的外部频率。

### 第二层：五大“用电网络”（时钟信号 - 脉冲送到哪里？）

有了发电机，接下来就是通过不同的网络，把频率降频或直接分配给不同的部门。这就是你在代码和 SysConfig 里最常看到的名字：

#### MCLK (Main Clock - 主时钟)

- **频率**：通常等于 SYSOSC 的频率（最高 80MHz）。
- **比喻**：**厂长（CPU）的大脑运转速度**。
- **作用**：它专门用来驱动 ARM Cortex-M0+ 内核、SRAM 内存和 Flash 闪存。MCLK 越快，你的代码执行得就越快。当单片机进入低功耗休眠模式时，MCLK 就会停止（厂长下班睡觉了）。

#### BUSCLK (Bus Clock - 总线时钟)

- **频率**：等于 MCLK 或者 MCLK 的分频。
- **比喻**：**厂区内部的数据物流传送带**。
- **作用**：就像我们上一条说的，厂长（CPU）要把计算好的数据送给串口、定时器或者 GPIO 引脚，必须通过这条传送带。传送带停了，数据就发不出去了。

#### ULPCLK (Ultra-Low Power Clock - 超低功耗时钟)

- **频率**：等于 MCLK，或者降频运行。
- **比喻**：**节能车间的生产线速度**。
- **作用**：这是 MSPM0 为了省电搞出的一个“骚操作”。有些外设（比如某些低功耗定时器、模拟比较器）不需要像 CPU 跑得那么快。把它们的时钟挂在 ULPCLK 上，即使在某些半休眠模式下，CPU（MCLK）停了，ULPCLK 依然可以挂着低频慢慢跑，维持基本的心跳。

#### MFCLK (Mid-Frequency Clock - 中频时钟)

- **频率**：固定在 4 MHz（由 SYSOSC 降频而来）。
- **比喻**：部分精密机器自带的**独立中速小马达**。
- **作用**：不管你的厂长（MCLK）现在是在全速跑 80MHz 还是降速跑 16MHz，MFCLK **永远稳如老狗地输出 4MHz**。它专门给 ADC（模数转换器）之类对频率稳定性要求极高的模拟外设使用。这样 CPU 怎么瞎折腾频率，都不会影响传感器采集的精度。

#### LFCLK (Low-Frequency Clock - 低频时钟)

- **频率**：32.768 kHz（来自 LFOSC 或外部 LFXT）。
- **比喻**：**门卫大爷的怀表**。
- **作用**：全厂停工、停电（进入最深度的休眠模式 Standby），连主机房都黑灯瞎火了，LFCLK 依然在跳动。它专门供给 RTC（万年历）和 WDT（看门狗）。

## 配置时钟

- `CPUCLK_FREQ = 80000000`，主频 80 MHz。
- 外部高频晶振 `HFXT`：40 MHz，管脚 `PA5/HFXIN`、`PA6/HFXOUT`。
- `SYSPLL` 输入选择 `HFCLK`，输出 `SYSPLL0`，作为 `HSCLK` 和 `MCLK` 来源。
- `UDIV = 2`，所以 `ULPCLK / BUSCLK` 为 40 MHz。
- `MFCLKGATE` 使能，UART 等可用 4 MHz `MFCLK`。
- `SysTick` 周期 `80000`，在 80 MHz CPUCLK 下等于 1 ms，并使能中断、启动计数器。

## SysConfig 配置文件

### SysConfig 的作用

SysConfig 是 TI 提供的图形化/脚本化配置工具。它的作用类似 STM32CubeMX，主要用来完成：

1. 芯片型号选择。
2. 封装和引脚分配。
3. 时钟树配置。
4. GPIO 输入输出配置。
5. UART、DMA、SysTick 等外设配置。
6. 自动生成 `ti_msp_dl_config.c/.h`。

## SysConfig GUI 配置

1. 打开当前工程的 `empty.syscfg`。
2. 进入 `SYSCTL`，勾选 `Clock Tree`，保持 `Force Default Clock Configuration` 为使能。
3. 在 Clock Tree 中配置 `HFXT`：Enable，Input Frequency = `40 MHz`，Startup = `100 us`，HFCLK Monitor = Enable。
4. 配置 `EXHFMUX` 选择 `XTAL`，`HFCLKEXT` 输入频率也填 `40 MHz`。
5. 配置 `SYSPLLMUX` 选择 `HFCLK`，`PLL_QDIV` 设为 `4`，`HSCLKMUX` 选择 `SYSPLL0`。
6. 配置 `UDIV` 为 `2`，并使能 `MFCLKGATE`。
7. `SYSCTL` 中使能 `Validate Clock Status`。
8. 进入 `SYSTICK`，使能 `Period`，Period 填 `80000`，使能 `Interrupt`，Priority 设为 `0`，并使能 `SysTick`。

![Snipaste_2026-07-05_20-37-10](/notes/lecture-01-clock-gpio/image/Snipaste_2026-07-05_20-37-10.webp)

![7213c19c-c367-496c-8cb5-a96bded0049b](/notes/lecture-01-clock-gpio/image/7213c19c-c367-496c-8cb5-a96bded0049b.webp)



![e562d35b-378d-458a-b411-6000487a0f42](/notes/lecture-01-clock-gpio/image/e562d35b-378d-458a-b411-6000487a0f42.webp)

![2505225d-d612-4586-8c34-4463481737e6](/notes/lecture-01-clock-gpio/image/2505225d-d612-4586-8c34-4463481737e6.webp)



## 裸机调度器

###  调度器的作用

本工程没有使用 RTOS，而是使用一个简单的时间片轮询调度器。

调度器解决的问题是：

1. 不想在 `while(1)` 里堆很多 `if`。
2. 希望不同任务按不同周期运行。
3. 希望任务结构清晰，方便添加和删除。

### 系统节拍 `uwTick`

```c
volatile uint32_t uwTick = 0;



void SysTick_Handler(void)
{
    uwTick++;
}
```

1. `volatile`

表示变量可能在中断中被修改，主循环每次读取都必须从内存重新取值。

2. `uwTick++`

SysTick 每 1 ms 中断一次，所以 `uwTick` 表示系统运行的毫秒数。

实际开发中怎么修改：

1. 不要在 SysTick 中断里打印、延时或执行复杂算法。
2. 如果需要定时任务，用 `uwTick` 做时间判断，不要在中断里直接跑任务。

### 任务表

任务结构体：

```c
typedef struct {
    void (*task_func)(void);
    uint32_t rate_ms;//执行时间
    uint32_t last_run;//上次运行的时间
} task_t;
```

字段解释：

| 字段        | 作用                    |
| ----------- | ----------------------- |
| `task_func` | 任务函数指针。          |
| `rate_ms`   | 任务运行周期，单位 ms。 |
| `last_run`  | 上一次运行时间。        |

当前任务表：

```c
task_t scheduler_task[] = {
     {key_task, 10, 0},
     {uart_task, 10, 0},
     {jy901s_app_task, 100, 0},
};
```

当前实际运行：

| 任务              |  周期 | 作用                                       |
| ----------------- | ----: | ------------------------------------------ |
| `uart_task`       | 10 ms | 检查 DMA 接收位置，将数据读出并打印。      |
| `jy901s_app_task` | 10 ms | 检查 JY901S 角度数据，按 100 ms 节奏打印。 |

`key_task` 当前被注释，所以按键不会被调度执行。

### 调度逻辑

```c
void scheduler_run(void)
{
    for (uint8_t i = 0; i < task_num; i++) {
        uint32_t now_time = uwTick;
        if (now_time >= scheduler_task[i].rate_ms + scheduler_task[i].last_run) {
            scheduler_task[i].last_run = now_time;
            scheduler_task[i].task_func();
        }
    }
}
```

工作过程：

1. 读取当前时间 `uwTick`。
2. 遍历任务表。
3. 判断当前时间是否超过任务周期。
4. 到时间就更新 `last_run`。
5. 调用对应任务函数。

实际开发中怎么使用和修改：

1. 新增按键任务：

```c
{key_task, 10, 0},
```

2. 新增 LED 任务：

```c
{led_task, 20, 0},
```

3. 新增传感器采样任务：

```c
{sensor_task, 5, 0},
```

注意事项：

1. 这是非抢占式调度，一个任务执行太久会影响后面的任务。
2. 任务函数里不要长时间 `while` 等待。
3. 任务函数里尽量不要调用阻塞式延时。
4. 需要高实时性的功能应放在中断或 DMA 中完成最小工作量，再交给主循环处理。

## KEY 按键代码

### 引脚定义

![Snipaste_2026-07-05_19-03-00](/notes/lecture-01-clock-gpio/image/Snipaste_2026-07-05_19-03-00.webp)

![Snipaste_2026-07-05_19-04-01](/notes/lecture-01-clock-gpio/image/Snipaste_2026-07-05_19-04-01.webp)

```c
#define KEY2_PORT   GPIOB
#define KEY2_PIN    DL_GPIO_PIN_24

#define KEY3_PORT   GPIOA
#define KEY3_PIN    DL_GPIO_PIN_27

#define KEY4_PORT   GPIOA
#define KEY4_PIN    DL_GPIO_PIN_26
```

这些手写宏和 SysConfig 配置一致。

| 按键 | 端口  | 引脚 | 电平逻辑   |
| ---- | ----- | ---: | ---------- |
| KEY2 | GPIOB | PB24 | 低电平按下 |
| KEY3 | GPIOA | PA27 | 低电平按下 |
| KEY4 | GPIOA | PA26 | 低电平按下 |

### 按键读取函数

```c
uint8_t key_read(void)
{
    uint8_t temp = 0;

    if (DL_GPIO_readPins(KEY2_PORT, KEY2_PIN) == 0) temp = 2;
    if (DL_GPIO_readPins(KEY3_PORT, KEY3_PIN) == 0) temp = 3;
    if (DL_GPIO_readPins(KEY4_PORT, KEY4_PIN) == 0) temp = 4;

    return temp;
}
```

功能说明：

1. 默认返回 0，表示没有按键按下。
2. KEY2 按下返回 2。
3. KEY3 按下返回 3。
4. KEY4 按下返回 4。

为什么用 `== 0`：

按键配置为输入上拉，未按下时是高电平，按下时被拉低，所以低电平代表按下。

实际开发中怎么修改：

1. 如果按键改成下拉电路，判断条件应改成 `!= 0`。
2. 如果要做消抖，可以让 `key_task` 以 10 ms 周期运行，并增加稳定计数。

### 按下和松开判断

```c
key_val = key_read();
key_down = key_val & (key_old ^ key_val);
key_up   = ~key_val & (key_old ^ key_val);
key_old  = key_val;
```

变量解释：

| 变量       | 作用           |
| ---------- | -------------- |
| `key_val`  | 当前按键值。   |
| `key_old`  | 上一次按键值。 |
| `key_down` | 新按下的按键。 |
| `key_up`   | 新松开的按键。 |

核心思想：

1. `key_old ^ key_val` 用来找变化。
2. `key_val & change` 表示从未按下变成按下。
3. `~key_val & change` 表示从按下变成未按下。

## LED 显示代码

![Snipaste_2026-07-05_19-05-16](/notes/lecture-01-clock-gpio/image/Snipaste_2026-07-05_19-05-16.webp)

![Snipaste_2026-07-05_19-04-46](/notes/lecture-01-clock-gpio/image/Snipaste_2026-07-05_19-04-46.webp)

### LED 输出宏

```c
#define PIN_WRITE(PORT, PIN, STATE) \
    ((STATE) ? DL_GPIO_setPins(PORT, PIN) : DL_GPIO_clearPins(PORT, PIN))
```

功能说明：

1. `STATE` 为  1  时，调用 `DL_GPIO_setPins()` 输出高电平。
2. `STATE` 为  0 时，调用 `DL_GPIO_clearPins()` 输出低电平。
3. 这个宏把 DriverLib 的置位/清零接口封装成类似写引脚的形式。

和 STM32 写法对比：

```c
HAL_GPIO_WritePin(GPIOx, GPIO_PIN_x, GPIO_PIN_SET);
```

MSPM0 DriverLib 不使用 HAL 句柄，而是直接传**端口**和**引脚掩码**。

###  LED 状态数组

```c
uint8_t ucLed[4] = {0,0,0,0};
```

设计思路：

1. 应用层只修改 `ucLed[]`。
2. 显示函数统一把数组状态输出到 GPIO。
3. 后期如果 LED 显示逻辑变化，不需要每个业务模块都直接操作 GPIO。

### LED 显示函数

```c
void led_disp(uint8_t *ucLed)
{
    uint8_t temp = 0x00;
    static uint8_t temp_old = 0xff;

    for (int i = 0; i < 6; i++)
    {
        if (ucLed[i]) temp |= (1 << i);
    }

    if (temp != temp_old)
    {
        PIN_WRITE(LED1_PORT, LED1_PIN, temp & 0x02);
        PIN_WRITE(LED2_PORT, LED2_PIN, temp & 0x04);
        PIN_WRITE(LED3_PORT, LED3_PIN, temp & 0x08);
        PIN_WRITE(LED4_PORT, LED4_PIN, temp & 0x10);
        temp_old = temp;
    }
}
```

功能说明：

1. `temp` 用位的形式保存多个 LED 状态。
2. `temp_old` 保存上一次输出状态。
3. 只有状态变化时才重新写 GPIO。