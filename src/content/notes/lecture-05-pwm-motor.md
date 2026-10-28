# 米醋电子工作室-TI M0系列 第四讲 PWM 外部中断 电机驱动

DRV8871 是 TI 推出的单路全桥（H 桥）直流电机驱动 IC。本项目使用了**两颗** DRV8871DDA 芯片组合构建双路驱动方案，以实现对两个直流电机的独立控制。其主要特性如下：

| 特性             | 参数                                                   |
| :--------------- | :----------------------------------------------------- |
| **驱动拓扑**     | 单路全桥（H 桥），本项目通过双芯片组合实现双路独立控制 |
| **供电电压**     | 6.5 V ～ 45 V（电机侧），适合锂电池或直流电源          |
| **持续输出电流** | 3.6 A（峰值），适合中小功率直流电机                    |
| **控制方式**     | IN1 / IN2 双 PWM 输入（无独立方向引脚）                |
| **制动模式**     | 快衰减（Fast Decay）/ 慢衰减（Slow Decay）可选         |
| **保护功能**     | 过流保护 (ILIM)、过温保护 (TSD)、欠压锁定 (UVLO)       |
| **封装**         | HSOP-8（DDA 后缀），带底侧散热焊盘 (PowerPAD)          |

## 与 TB6612 驱动的关键差异

| 对比项 | TB6612 | DRV8871 |
|---|---|---|
| 方向控制 | 独立 GPIO（IN1/IN2）+ 单路 PWM | IN1/IN2 **直接接 PWM**，哪路有信号决定方向 |
| GPIO 方向引脚 | 需要 | **不需要** |
| PWM 通道数 | 每路电机 1 个 | 每路电机 **2 个**（IN1 与 IN2 各占一个 CC 通道） |

---

## 硬件接线

```
左轮 (TIMG7 — TimerG 类型)
  AIN1  →  PB16  TIMG7_C1  (CC1 通道)
  AIN2  →  PB15  TIMG7_C0  (CC0 通道)

右轮 (TIMA1 — TimerA 类型)
  BIN1  →  PB3   TIMA1_C1  (CC1 通道)
  BIN2  →  PB2   TIMA1_C0  (CC0 通道)
```

左右轮使用**不同类型**的定时器外设（TimerG / TimerA）

---

## DRV8871 快衰减（Fast Decay）控制逻辑

DRV8871 的运动状态完全由两路输入引脚的电平决定：

| 状态 | IN1 | IN2 | CC 寄存器值 |
|---|---|---|---|
| 正转 | PWM | 低电平 | `C1 = duty, C0 = 0` |
| 反转 | 低电平 | PWM | `C1 = 0, C0 = duty` |
| 刹车（制动） | 高电平 | 高电平 | `C1 = PERIOD, C0 = PERIOD` |
| 滑行（高阻） | 低电平 | 低电平 | `C1 = 0, C0 = 0` |

> 本模块停止时选择**滑行（高阻）**而非刹车，两路 CC 置 0 即可实现。

---

## CC（Capture/Compare）通道说明

CC 是 **Capture/Compare**（捕获/比较）的缩写，是 MSPM0 系列定时器中每个定时器实例内部的多功能寄存器通道，在不同工作模式下承担不同职责：

| 模式                | 名称     | 作用                                                         |
| ------------------- | -------- | ------------------------------------------------------------ |
| Compare（比较）模式 | 输出比较 | 计数值达到 CC 值时翻转/置位/清零对应引脚，**PWM 输出即此模式** |
| Capture（捕获）模式 | 输入捕获 | 外部引脚发生边沿时将当前计数值锁存到 CC 寄存器，用于测量脉宽或频率 |

本驱动中所有 CC 通道均工作在 **Compare（输出比较）模式**，用于生成 PWM 波形。

### CC 值与 PWM 占空比的关系

```
计数值  0 ──────────────────────────► LOAD（周期上限）
                   ▲
                   CC 值
                   │
                   ├── 计数值 < CC  → 引脚输出高电平
                   └── 计数值 ≥ CC  → 引脚输出低电平

占空比(%) = CC 值 / LOAD 值 × 100
```

例如 LOAD = 1000，CC = 700，则占空比为 70%。CC = 0 时引脚始终为低电平（0%），CC = LOAD 时引脚始终为高电平（100%）。

### 为什么 DRV8871 每路电机需要两个 CC 通道

TB6612 靠独立 GPIO 控制方向，每路电机只需 **1 个 CC 通道**输出速度 PWM。

DRV8871 取消了方向 GPIO，IN1 和 IN2 两根引脚**各自都需要 PWM 信号**，因此每路电机占用 **2 个 CC 通道**：

```
正转：CC1 = duty（IN1 有 PWM）  CC0 = 0（IN2 低电平）
反转：CC1 = 0（IN1 低电平）     CC0 = duty（IN2 有 PWM）
停止：CC1 = 0                   CC0 = 0（两路均低电平，滑行）
```

方向完全由"哪个通道有占空比、哪个为 0"决定，无需额外 GPIO。

## 宏定义详解

### CC 通道索引宏

```c
#define MOTOR_LEFT_IN1_CC_IDX   DL_TIMER_CC_1_INDEX   /* AIN1 → C1 */
#define MOTOR_LEFT_IN2_CC_IDX   DL_TIMER_CC_0_INDEX   /* AIN2 → C0 */
#define MOTOR_RIGHT_IN1_CC_IDX  DL_TIMER_CC_1_INDEX   /* BIN1 → C1 */
#define MOTOR_RIGHT_IN2_CC_IDX  DL_TIMER_CC_0_INDEX   /* BIN2 → C0 */
```

将引脚与 CC（Capture/Compare）通道的对应关系集中定义，修改硬件接线时只需改动此处。

#### `DL_TIMER_CC_INDEX` 枚举

```c
typedef enum {
    DL_TIMER_CC_0_INDEX = 0,   /* Capture Compare 通道 0 */
    DL_TIMER_CC_1_INDEX = 1,   /* Capture Compare 通道 1 */
    DL_TIMER_CC_2_INDEX = 2,   /* Capture Compare 通道 2（部分实例支持）*/
    DL_TIMER_CC_3_INDEX = 3,   /* Capture Compare 通道 3（部分实例支持）*/
    DL_TIMER_CC_4_INDEX = 4,
    DL_TIMER_CC_5_INDEX = 5,
} DL_TIMER_CC_INDEX;
```

**作用**：标识定时器的 CC 寄存器通道编号，作为 `DL_Timer_setCaptureCompareValue` 等函数的通道选择参数传入。TIMG7 和 TIMA1 均支持通道 0 和通道 1。

> `dl_timerg.h` 中 `DL_TIMERG_CAPTURE_COMPARE_0_INDEX` 是对 `DL_TIMER_CC_0_INDEX` 的重定向别名，两者等价。

---

### 定时器启停封装

```c
#define MOTOR_LEFT_START()   DL_TimerG_startCounter(MOTOR_PWM_LEFT_INST)
#define MOTOR_RIGHT_START()  DL_TimerA_startCounter(MOTOR_PWM_RIGHT_INST)
```

**切换定时器类型时只需修改这两行。**

#### `DL_Timer_startCounter`

**定义位置**：`source/ti/driverlib/dl_timer.h`

```c
__STATIC_INLINE void DL_Timer_startCounter(GPTIMER_Regs *gptimer)
{
    gptimer->COUNTERREGS.CTRCTL |= (GPTIMER_CTRCTL_EN_ENABLED);
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `gptimer` | `GPTIMER_Regs *` | 目标定时器外设的寄存器结构体指针，即 `MOTOR_PWM_LEFT_INST`（TIMG7）或 `MOTOR_PWM_RIGHT_INST`（TIMA1） |

**返回值**：无。

**底层操作**：向 `CTRCTL` 寄存器的 `EN` 位写入 `ENABLED`，使定时器计数器开始运行，PWM 波形立即输出至对应引脚。

> `DL_TimerG_startCounter` 与 `DL_TimerA_startCounter` 均为该函数的宏重定向，底层实现完全一致，差异仅在于传入的外设实例不同：
>
> ```c
> /* dl_timerg.h */
> #define DL_TimerG_startCounter   DL_Timer_startCounter
>
> /* dl_timera.h */
> #define DL_TimerA_startCounter   DL_Timer_startCounter
> ```

---

### CC 值写入封装

```c
#define MOTOR_LEFT_SET_CC(ch, val)  \
    DL_TimerG_setCaptureCompareValue(MOTOR_PWM_LEFT_INST,  (val), (ch))
#define MOTOR_RIGHT_SET_CC(ch, val) \
    DL_TimerA_setCaptureCompareValue(MOTOR_PWM_RIGHT_INST, (val), (ch))
```

#### `DL_Timer_setCaptureCompareValue`

**定义位置**：`source/ti/driverlib/dl_timer.h`

```c
void DL_Timer_setCaptureCompareValue(
    GPTIMER_Regs *gptimer,
    uint32_t value,
    DL_TIMER_CC_INDEX ccIndex);
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `gptimer` | `GPTIMER_Regs *` | 目标定时器外设寄存器指针 |
| `value` | `uint32_t` | 写入 CC 寄存器的比较值，范围 `0 ~ PERIOD`。`0` 输出低电平（0% 占空比），等于 PERIOD 时输出高电平（100% 占空比），中间值对应相应占空比 |
| `ccIndex` | `DL_TIMER_CC_INDEX` | 目标通道编号，`DL_TIMER_CC_0_INDEX`（IN2）或 `DL_TIMER_CC_1_INDEX`（IN1） |

**返回值**：无。

**PWM 输出原理**：定时器从 0 计数到 LOAD 值，计数值小于 CC 值时输出高电平，达到 CC 值时翻转为低电平，如此循环产生 PWM 波形。通过改变 CC 值即可实时调整占空比，无需停止定时器。

> `DL_TimerG_setCaptureCompareValue` 和 `DL_TimerA_setCaptureCompareValue` 均为该函数的宏重定向：
>
> ```c
> /* dl_timerg.h */
> #define DL_TimerG_setCaptureCompareValue   DL_Timer_setCaptureCompareValue
>
> /* dl_timera.h */
> #define DL_TimerA_setCaptureCompareValue   DL_Timer_setCaptureCompareValue
> ```

---

### PWM 周期值

```c
#define MOTOR_PWM_PERIOD    (1000U)
```

与 SysConfig 中 `PWM → Period Count` 配置保持一致。实际实现中通过 `DL_Timer_getLoadValue()` 动态读取，此宏可作为文档参考或静态计算备用。

---

##  数据类型

###  方向枚举 `Motor_DIRC_Def_t`

```c
typedef enum {
    DIRC_STOP     = 0,   /* 停止（滑行） */
    DIRC_FOWARD   = 1,   /* 正转 */
    DIRC_BACKWARD = 2    /* 反转 */
} Motor_DIRC_Def_t;
```

记录电机当前的运动方向，供速度计算符号修正使用。

### 电机控制结构体 `MOTOR_Def_t`

```c
typedef struct {
    Motor_DIRC_Def_t  Motor_Dirc;           /* 当前方向 */
    uint8_t           reverse;              /* 方向反转标志: 0=正常 1=反转 */
    int32_t          *Motor_Encoder_Addr;   /* 指向编码器计数变量的指针 */
} MOTOR_Def_t;
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `Motor_Dirc` | 枚举 | 当前方向状态，由 `Motor_SetDuty` 写入 |
| `reverse` | `uint8_t` | 安装方向反转补偿。左轮 `reverse=0`，右轮 `reverse=1`（对称安装导致物理方向相反） |
| `Motor_Encoder_Addr` | `int32_t *` | 指向 `Data_MotorEncoder[]` 对应元素，由编码器中断外部写入，`Motor_GetSpeed` 读取后清零 |

> **设计要点**：结构体中**不存储**定时器实例指针或通道索引，通过 `if (Motor == &Motor_Left)` 分支在宏层面处理不同定时器类型，避免函数指针或虚表开销。

---

##  全局对象与缓冲区

```c
extern MOTOR_Def_t Motor_Left;
extern MOTOR_Def_t Motor_Right;
extern int32_t     Data_MotorEncoder[2];
```

| 对象 | 说明 |
|---|---|
| `Motor_Left` | 左轮控制对象，`reverse=0`，编码器地址指向 `Data_MotorEncoder[0]` |
| `Motor_Right` | 右轮控制对象，`reverse=1`（对称安装补偿），编码器地址指向 `Data_MotorEncoder[1]` |
| `Data_MotorEncoder[2]` | 编码器原始计数缓冲，由外部编码器中断累加，`Motor_GetSpeed` 读取后置零 |

---

## 函数接口详解

###  `Motor_Start`

```c
void Motor_Start(void);
```

**功能**：启动左轮和右轮 PWM 定时器，并立即将两路输出初始化为滑行停止状态。

**执行顺序**：

```
1. MOTOR_LEFT_START()   → DL_TimerG_startCounter(MOTOR_PWM_LEFT_INST)
2. MOTOR_RIGHT_START()  → DL_TimerA_startCounter(MOTOR_PWM_RIGHT_INST)
3. Motor_Stop()         → 双路 CC 置 0，确保初始安全
```

##### `DL_TimerG_startCounter` / `DL_TimerA_startCounter`

均为 `DL_Timer_startCounter` 的宏重定向：

```c
__STATIC_INLINE void DL_Timer_startCounter(GPTIMER_Regs *gptimer)
{
    gptimer->COUNTERREGS.CTRCTL |= (GPTIMER_CTRCTL_EN_ENABLED);
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `gptimer` | `GPTIMER_Regs *` | 定时器外设寄存器基地址指针。左轮传入 `MOTOR_PWM_LEFT_INST`（TIMG7），右轮传入 `MOTOR_PWM_RIGHT_INST`（TIMA1） |

**返回值**：无。

**底层行为**：对 `CTRCTL` 寄存器执行按位或操作，置位 `EN` 字段为 `ENABLED`，定时器计数器立即启动，PWM 波形开始输出至引脚。调用前若 CC 值未初始化则引脚电平不确定，因此 `Motor_Start` 在启动后立即调用 `Motor_Stop` 强制清零。

---

### `Motor_SetDuty`

```c
bool Motor_SetDuty(MOTOR_Def_t *Motor, float value);
```

**参数**：

| 参数 | 类型 | 范围 | 说明 |
|---|---|---|---|
| `Motor` | `MOTOR_Def_t *` | `&Motor_Left` 或 `&Motor_Right` | 目标电机对象指针 |
| `value` | `float` | −100.0 ～ +100.0 | 占空比百分比，正值正转，负值反转，0 滑行 |

**返回值**：`true` 成功；`false` 传入 NULL 指针。

**执行流程**：

```
1. 检查 Motor != NULL
2. 限幅：value 截断至 [-100.0, +100.0]
3. 若 Motor->reverse == 1，对 value 取反
4. value == 0 → 滑行停止（IN1=0, IN2=0），Motor_Dirc = DIRC_STOP
5. value != 0 →
     period = DL_Timer_getLoadValue(timx)      ← 读取定时器实际周期
     duty   = fabs(value) / 100.0 × period
     value > 0 → IN1=duty, IN2=0，DIRC_FOWARD
     value < 0 → IN1=0,    IN2=duty，DIRC_BACKWARD
```

##### `DL_Timer_getLoadValue`

```c
__STATIC_INLINE uint32_t DL_Timer_getLoadValue(const GPTIMER_Regs *gptimer)
{
    return (gptimer->COUNTERREGS.LOAD & GPTIMER_LOAD_LD_MAXIMUM);
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `gptimer` | `const GPTIMER_Regs *` | 定时器外设寄存器基地址指针（`const` 修饰，只读操作） |

**返回值**：`uint32_t`，定时器 `LOAD` 寄存器的当前值，即 PWM 的计数周期上限（Period Count）。

**作用**：读取 `COUNTERREGS.LOAD` 寄存器并与掩码 `GPTIMER_LOAD_LD_MAXIMUM` 取与，得到有效的周期值。`Motor_SetDuty` 用此值动态计算占空比计数，避免硬编码 `MOTOR_PWM_PERIOD` 常量，保证与 SysConfig 配置始终一致。

**使用场景**（摘自源码）：

```c
GPTIMER_Regs *timx = (Motor == &Motor_Left)
                     ? (GPTIMER_Regs *)MOTOR_PWM_LEFT_INST
                     : (GPTIMER_Regs *)MOTOR_PWM_RIGHT_INST;
uint32_t period = DL_Timer_getLoadValue(timx);
uint32_t duty   = (uint32_t)((fabs(value) / 100.0f) * (float)period);
```

##### `DL_Timer_setCaptureCompareValue`（经由 `DRV8871_SetCC` 间接调用）

```c
void DL_Timer_setCaptureCompareValue(
    GPTIMER_Regs *gptimer,
    uint32_t value,
    DL_TIMER_CC_INDEX ccIndex);
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `gptimer` | `GPTIMER_Regs *` | 目标定时器外设寄存器指针 |
| `value` | `uint32_t` | CC 比较值。`0` = 引脚始终低（0% 占空比）；等于 `period` = 引脚始终高（100% 占空比）；中间值 = 对应占空比 |
| `ccIndex` | `DL_TIMER_CC_INDEX` | 目标通道，`DL_TIMER_CC_0_INDEX`（IN2）或 `DL_TIMER_CC_1_INDEX`（IN1） |

**返回值**：无。

**PWM 输出原理**：定时器从 0 计数到 LOAD 值，计数值小于 CC 值时输出高电平，达到 CC 值时翻转为低电平，循环产生 PWM 波形。通过改变 CC 值即可实时调整占空比，无需停止定时器。

---

### `Motor_GetSpeed`

```c
bool Motor_GetSpeed(MOTOR_Def_t *Motor, uint16_t time);
```

**参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `Motor` | `MOTOR_Def_t *` | 目标电机 |
| `time` | `uint16_t` | 上次调用至今的采样间隔，单位 ms |

**返回值**：`true` 成功；`false` 传入 NULL 指针。

**执行流程**：

```
1. interval_time = time / 1000.0               （ms 转换为秒）
2. encoder_value = *Motor->Motor_Encoder_Addr  （读取编码器脉冲计数）
3. *Motor->Motor_Encoder_Addr = 0             （清零，归位下次采样）
4. speed = encoder_value / interval_time       （单位：脉冲/秒）
5. 若当前方向为 DIRC_BACKWARD，speed 取反
```

> **注意**：当前实现的 `speed` 为局部变量，未输出到结构体或外部。如需在外部使用速度值，应补充输出参数或写回结构体字段。

本函数不直接调用 DL 库 API，编码器计数由外部定时器中断服务程序通过 `Motor_Encoder_Addr` 指针写入。

---

###  `Motor_Stop`

```c
void Motor_Stop(void);
```

**功能**：同时将左右两路电机设置为滑行停止（IN1=Lo，IN2=Lo，高阻态）。

**实现**：以 `value=0.0f` 分别调用 `Motor_SetDuty`，复用限幅和方向反转逻辑。

内部最终调用 `DL_Timer_setCaptureCompareValue`，将 IN1 和 IN2 两路 CC 值均写为 `0`：

```c
/* 两路 CC 置 0 → IN1=Lo, IN2=Lo → 滑行高阻 */
DL_Timer_setCaptureCompareValue(MOTOR_PWM_LEFT_INST,  0, DL_TIMER_CC_1_INDEX);
DL_Timer_setCaptureCompareValue(MOTOR_PWM_LEFT_INST,  0, DL_TIMER_CC_0_INDEX);
DL_Timer_setCaptureCompareValue(MOTOR_PWM_RIGHT_INST, 0, DL_TIMER_CC_1_INDEX);
DL_Timer_setCaptureCompareValue(MOTOR_PWM_RIGHT_INST, 0, DL_TIMER_CC_0_INDEX);
```

---

### `Motor_SetSpeed`

```c
void Motor_SetSpeed(float left_speed, float right_speed);
```

**参数**：

| 参数 | 范围 | 说明 |
|---|---|---|
| `left_speed` | −100.0 ～ +100.0 | 左轮目标占空比百分比 |
| `right_speed` | −100.0 ～ +100.0 | 右轮目标占空比百分比 |

**功能**：最常用的顶层接口，顺序调用两次 `Motor_SetDuty`，一次完成左右轮速度设置。

**典型用法**：

```c
Motor_SetSpeed( 50.0f,  50.0f);   /* 双轮正转，50% 占空比 */
Motor_SetSpeed(-30.0f,  30.0f);   /* 左轮反转，右轮正转，原地左转 */
Motor_SetSpeed(  0.0f,   0.0f);   /* 双轮滑行停止 */
```

---

## 内部静态函数

```c
static void DRV8871_SetCC(MOTOR_Def_t *Motor, uint32_t in1_val, uint32_t in2_val);
```

根据 `Motor` 指针判断目标轮，调用对应的 `MOTOR_LEFT_SET_CC` 或 `MOTOR_RIGHT_SET_CC` 宏，同时写入 IN1 和 IN2 的 CC 值。此函数是对底层定时器类型差异的统一封装点。

---

## DL 库 API 总览

| API | 头文件 | 类型 | 作用 |
|---|---|---|---|
| `DL_Timer_startCounter` | `dl_timer.h` | `inline` 函数 | 启动定时器计数器，置位 `CTRCTL.EN` |
| `DL_TimerG_startCounter` | `dl_timerg.h` | 宏重定向 | 等价于 `DL_Timer_startCounter`，用于 TimerG 实例 |
| `DL_TimerA_startCounter` | `dl_timera.h` | 宏重定向 | 等价于 `DL_Timer_startCounter`，用于 TimerA 实例 |
| `DL_Timer_getLoadValue` | `dl_timer.h` | `inline` 函数 | 读取 `LOAD` 寄存器，获取 PWM 周期计数值 |
| `DL_Timer_setCaptureCompareValue` | `dl_timer.h` | 普通函数 | 写入指定 CC 通道的比较值，实时调整 PWM 占空比 |
| `DL_TimerG_setCaptureCompareValue` | `dl_timerg.h` | 宏重定向 | 等价于 `DL_Timer_setCaptureCompareValue`，用于 TimerG |
| `DL_TimerA_setCaptureCompareValue` | `dl_timera.h` | 宏重定向 | 等价于 `DL_Timer_setCaptureCompareValue`，用于 TimerA |
| `DL_TIMER_CC_INDEX` | `dl_timer.h` | 枚举类型 | CC 通道编号（0～5），作为通道选择参数 |
| `DL_TIMER_CC_0_INDEX` | `dl_timer.h` | 枚举值 `= 0` | 选择 CC 通道 0（对应 IN2 引脚） |
| `DL_TIMER_CC_1_INDEX` | `dl_timer.h` | 枚举值 `= 1` | 选择 CC 通道 1（对应 IN1 引脚） |

---

## 数据流与调用层级

```
用户层
  Motor_SetSpeed(left, right)
        │
        ├── Motor_SetDuty(&Motor_Left, left)
        │       │
        │       ├── DL_Timer_getLoadValue(TIMG7)          ← 读取 PWM 周期
        │       └── DRV8871_SetCC(&Motor_Left, in1, in2)
        │               │
        │               └── MOTOR_LEFT_SET_CC(ch, val)
        │                       │
        │                       └── DL_TimerG_setCaptureCompareValue
        │                               ↕ 宏重定向
        │                           DL_Timer_setCaptureCompareValue(TIMG7, val, ch)
        │
        └── Motor_SetDuty(&Motor_Right, right)
                │
                ├── DL_Timer_getLoadValue(TIMA1)          ← 读取 PWM 周期
                └── DRV8871_SetCC(&Motor_Right, in1, in2)
                        │
                        └── MOTOR_RIGHT_SET_CC(ch, val)
                                │
                                └── DL_TimerA_setCaptureCompareValue
                                        ↕ 宏重定向
                                    DL_Timer_setCaptureCompareValue(TIMA1, val, ch)
```

---

