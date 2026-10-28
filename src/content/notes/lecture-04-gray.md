# 米醋电子工作室-TI M0系列 第四讲 感为无MCU灰度

##  模块定位

```
控制层（PID 巡线控制）
       ↑  g_line_position_error / TrackN
  gray_app.c        ← 本模块
       ↓  API 调用
驱动层（No_Mcu_Gray）
       ↓  寄存器操作
硬件（ADC12_0 + GPIO 地址线 + 8 路灰度传感器）
```

---

##  硬件架构

###  传感器阵列

| 通道编号 | ch0  | ch1  | ch2  | ch3  | ch4  | ch5  | ch6  | ch7  |
| -------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 物理位置 | 最左 | ←    | ←    | 中左 | 中右 | →    | →    | 最右 |
| 权重值   | -4   | -3   | -2   | -1   | +1   | +2   | +3   | +4   |

###  多路复用电路

8 路传感器共用 **1 路 ADC 通道**，通过 3 位 GPIO 地址线控制模拟多路选择器（MUX）依次选通：

| 地址位 | GPIO 引脚 | 对应 bit |
| ------ | --------- | -------- |
| A0     | PB6       | bit 0    |
| A1     | PA9       | bit 1    |
| A2     | PB21      | bit 2    |

每通道采集 8 次取均值，消除 ADC 随机噪声。

## 接线说明

![ScreenShot_2026-07-14_012809_728](/notes/lecture-04-gray/image/ScreenShot_2026-07-14_012809_728.png)

![微信图片_20260714012832_61_14](/notes/lecture-04-gray/image/微信图片_20260714012832_61_14.png)

![微信图片_20260712222118_58_14](/notes/lecture-04-gray/image/微信图片_20260712222118_58_14.png)

![微信图片_20260712222234_59_14](/notes/lecture-04-gray/image/微信图片_20260712222234_59_14.png)



###  ADC 配置

- 外设：`ADC12_0_INST`
- 分辨率：12 bit（满量程 4096，由宏 `Sensor_ADCbits = _12Bits` 决定）
- 参考电压：3.3 V（由 MCU 供电决定）

---

##  数据流与处理流程

```
[每周期 Gray_Task() 调用]
         │
         ▼
No_Mcu_Ganv_Sensor_Task_Without_tick()
  ├─ Get_Analog_value()          → Analog_value[8]（8×8次ADC均值）
  ├─ convertAnalogToDigital()    → sensor.Digtal（8位数字状态）
  └─ normalizeAnalogValues()     → sensor.Normal_value[8]（归一化值）
         │
         ▼
Get_Anolog_Value()               → 本地 Anolog[8]（原始模拟量备份）
         │
         ▼
TrackN = ~Get_Digtal_For_User()  → TrackN（bit=1 表示该路压黑线）
         │
         ▼
BlackLine_SetTurn()              → g_line_position_error（偏差，送PID）
```

---

##  变量说明

###  全局变量

| 变量名                     | 类型               | 说明                           |
| ----------------------- | ---------------- | ---------------------------- |
| `Anolog[8]`             | `unsigned short` | 8 路原始 ADC 采样值（12 bit，0~4095） |
| `white[8]`              | `unsigned short` | 白色标定值（默认 1400，对应约 1.13 V）    |
| `black[8]`              | `unsigned short` | 黑色标定值（默认 600，对应约 0.48 V）     |
| `Normal[8]`             | `unsigned short` | 归一化缓冲（驱动层维护，应用层预留）           |
| `sensor`                | `No_MCU_Sensor`  | 驱动句柄，含校准系数、门限、状态位            |
| `TrackN`                | `uint8_t`        | 8 路数字状态位图（`extern` 供其他模块读取）  |
| `gray_weight[8]`        | `float`          | 加权表，对称分布，范围 [-4, +4]         |
| `g_line_position_error` | `float`          | 当前巡线偏差，供 PID 控制器使用           |

###  TrackN 位图定义

```
bit7  bit6  bit5  bit4  bit3  bit2  bit1  bit0
 ch7   ch6   ch5   ch4   ch3   ch2   ch1   ch0
(右端)                                  (左端)
  1 = 该路传感器检测到黑线（压线）
  0 = 该路传感器检测到白色（空地）
```

---

##  函数详解

###  `gray_init()`

**作用**：上电初始化，建立校准基准。

**调用时序**（必须在 `main()` 中、进入主循环前调用）：

```c
// main.c 示例
gray_init();   // 初始化灰度传感器
// ... 其他初始化 ...
while(1) {
    scheduler_run();
}
```

**内部执行步骤**：

```
No_MCU_Ganv_Sensor_Init_Frist()
  └─ memset 清零所有字段，ok=0
         │
No_Mcu_Ganv_Sensor_Task_Without_tick()
  └─ 采集一帧原始数据（预热 ADC，使通路稳定）
         │
Get_Anolog_Value()
  └─ 将采集结果写入本地 Anolog[]（仅为调试/参考，此时 ok=0）
         │
No_MCU_Ganv_Sensor_Init(white, black)
  ├─ 验证 white > black（不满足则自动交换）
  ├─ 计算判决门限：
  │     Gray_white[i] = (white[i]*2 + black[i]) / 3   （白判决线，约 white 的 2/3 处）
  │     Gray_black[i] = (white[i] + black[i]*2) / 3   （黑判决线，约 black 的 2/3 处）
  ├─ 计算归一化系数：Normal_factor[i] = 4096 / (white[i] - black[i])
  └─ ok=1，标记校准完成
```

**判决门限示意（默认 white=1400, black=600）**：

```
ADC值: 0    600   867   1133  1400  4095
            ↑     ↑           ↑
           黑     黑判决  白判决  白
           (0)   →迟滞区←    (1)
```

> 迟滞区（867~1133）保持上一次状态，防止临界值附近频繁跳变。

---

### `BlackLine_SetTurn()`

**作用**：将 `TrackN` 位图转换为标量偏差值，是巡线算法的核心计算。

**算法**：加权平均（Weighted Average）

```
          Σ (weight[i] × bit_i)
Err =  ─────────────────────────
             黑线通道数
```

**典型场景举例**：

| 场景 | TrackN 二进制 | 黑线通道 | weight_sum | blackline_count | Err |
|------|-------------|---------|-----------|----------------|-----|
| 正中压线 | 00011000 | ch3,ch4 | (-1)+(+1)=0 | 2 | **0.0**（居中） |
| 偏右 | 00110000 | ch4,ch5 | (+1)+(+2)=3 | 2 | **+1.5** |
| 偏左 | 00000110 | ch1,ch2 | (-3)+(-2)=-5 | 2 | **-2.5** |
| 仅最右 | 10000000 | ch7 | +4 | 1 | **+4.0**（极右） |
| 未检测到线 | 00000000 | — | 0 | 0 | **0.0**（无线保持） |

**注意**：未检测到黑线时返回 0，上层 PID 应结合历史状态或丢线处理策略使用。

---

###  `Gray_Task()`

**作用**：周期性任务函数，完成一次完整的采集-处理-输出流程。

**调用频率建议**：10 ms ~ 20 ms（取决于调度器配置）。

**执行开销估算**（基于 32 MHz 时钟）：

| 子步骤 | 耗时估算 |
|--------|---------|
| ADC 采集（8通道×8次） | ~1.5 ms |
| 数字化 + 归一化 | <0.1 ms |
| 串口打印（UART0） | 取决于波特率，115200bps 约 0.8 ms |
| BlackLine_SetTurn | <0.01 ms |

> **串口打印是主要耗时项**，量产版本应注释掉 `my_printf` 以降低 CPU 占用。

---

###  `gray_calibrate()`

**作用**：现场一键标定，自动采集白场和黑场 ADC 值，写入 `white[]`/`black[]` 并重新初始化驱动。

**调用方式**：在调度器启动前、主循环外单次调用（函数内含阻塞延时，不可放入调度器任务）。

```c
// main.c 示例
gray_init();          // 先用默认值初始化
gray_calibrate();     // 现场标定，覆盖默认值（约耗时 6s）
scheduler_init();
while (1) 
{
    scheduler_run(); 

}
```

**执行流程**：

```
① 串口打印 "white 3s..."
② DL_Delay(3000)          ← 阻塞等待 3s，用户将传感器移到白色地面
③ 循环 10 次：
      No_Mcu_Ganv_Sensor_Task_Without_tick()  采集一帧
      Get_Anolog_Value()                       读取模拟量
      sum[i] += Anolog[i]                      累加
      DL_Delay(10)                             帧间隔 10ms
④ white[i] = sum[i] / 10                     ← 10 帧均值写入 white[]
⑤ 串口打印白场采样结果

⑥ 串口打印 "black 3s..."
⑦ DL_Delay(3000)          ← 阻塞等待 3s，用户将传感器移到黑色地面
⑧ 同③ 采集 10 帧
⑨ black[i] = sum[i] / 10                     ← 10 帧均值写入 black[]
⑩ 串口打印黑场采样结果

⑪ No_MCU_Ganv_Sensor_Init(&sensor, white, black)  ← 重新计算门限系数
⑫ 串口打印 "ok . . ."
```

**串口输出示例**：

```
white 3s...
white: 1380-1390-1420-1400-1410-1360-1370-1400
black 3s...
black: 580-610-590-620-600-570-605-595
ok . . .
```

**注意事项**：

| 问题 | 说明 |
|------|------|
| 总耗时约 6s | 两次 3s 延时 + 采样时间，期间所有调度任务挂起 |
| 采样时传感器必须静止 | 移动或抖动会导致均值偏离真实值 |
| `white[i] - black[i]`  > 200 | 差值过小说明对比度不足，标定结果不可靠 |
| 驱动内部会自动处理 white < black 的情况 | 两者传反时会自动交换，不会崩溃 |

---

## 接口说明（供其他模块使用）

| 符号 | 类型 | 方向 | 说明 |
|------|------|------|------|
| `TrackN` | `extern uint8_t` | 输出 | 8 路数字状态位图 |
| `g_line_position_error` | `float`（全局） | 输出 | 巡线偏差，PID 输入 |
| `gray_init()` | 函数 | 调用 | 初始化，上电调用一次 |
| `gray_calibrate()` | 函数 | 调用 | 现场标定，调度器启动前调用，阻塞约 6s |
| `Gray_Task()` | 函数 | 调用 | 周期任务，放入调度器 |
| `BlackLine_SetTurn()` | 函数 | 调用 | 可独立调用以获取当前偏差 |

---

##  校准参数调整指南

实际使用需根据环境光照和传感器型号重新标定。

**标定步骤**：
1. 将传感器悬空（或置于白色地面），读取 8 路 `Anolog[]` 值，填入 `white[]`
2. 将传感器置于黑线正上方，读取 8 路 `Anolog[]` 值，填入 `black[]`
3. 确保 `white[i] - black[i] > 200`（差值过小说明对比度不足，检查光路或传感器）

**调试方法**：取消注释 `Gray_Task()` 中的模拟量打印，通过串口观察实时 ADC 值。

---

##  常见问题

| 现象 | 可能原因 | 排查方法 |
|------|---------|---------|
| `TrackN` 全 0，压线无响应 | white/black 标定值不匹配 | 打印 Anolog[]，比对标定值 |
| `TrackN` 全 1，未压线也触发 | white/black 标定值反转 | 检查初始化时传感器是否放置正确 |
| `g_line_position_error` 跳动剧烈 | ADC 噪声大或传感器安装松动 | 增加采集次数或软件滤波 |
| 偏差方向反 | 传感器左右安装反向 | 将 `Direction` 改为 0，或修改 `gray_weight[]` 符号 |
