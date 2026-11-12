# 如何跑后端测试（给不熟悉 Maven 的人）

这份文档只解决一件事：**把 `backend/` 的测试跑起来，看懂结果**。
你机器上已经有的东西我都会直接指出来，不需要你另外装。

---

## 0. 先搞懂一件事：为什么之前跑不起来

你机器上有三个"坑"，都不在代码里，在环境里：

| 现象 | 真实原因 |
| --- | --- |
| `mvn` 命令找不到 | Maven 没装到 PATH，但 **IntelliJ 自带一份** |
| `JAVA_HOME` 指向 `C:\Java\jdk-17` 却用不了 | 那个目录里**只有一个 MSI 安装包**，没有 `bin\java.exe`，等于装了一半 |
| 离线跑测试报 "artifacts could not be resolved" | 第一次跑 `test` 需要下载测试插件（surefire），必须联网一次；**你的网络是通的，我已经替你下好了** |

所以正确做法是：**用 IntelliJ 自带的那份 Maven + 自带的那份 JDK**，绕开坏掉的 `JAVA_HOME`。

---

## 方法一（最省事）：双击脚本

我在 `backend/` 下放了一个 `run-backend-tests.cmd`（内容全是英文提示，避免中文在 cmd 里因编码错乱，脚本本身你可以直接改）：

- 双击它 → 跑**全部**测试
- 命令行里 `run-backend-tests.cmd Settings` → 只跑**类名包含** `Settings` 的测试（会同时命中 `AppSettingsTest`、`RuntimeSettingsManagerTest`、`SettingsControllerTest`）

它做的事就是临时设好 JDK 与 Maven 路径再调用 `mvn test`。

> 小坑：Maven 的 `-Dtest=` 是**类名匹配**，不是子串匹配。写 `Settings` 匹配不到任何类会报
> `No tests matching pattern "Settings" were executed!`，所以脚本里自动补成了 `*Settings*`。

---

## 方法二（推荐长期用）：在 IntelliJ 里点

1. IntelliJ → `File > Open` → 选 **`D:\lfw-code\HelloJourney\backend\pom.xml`** → `Open as Project`。
2. 右下角等它把依赖下载完（第一次几分钟，之后不用）。
3. 打开任意测试类，比如
   `src/test/java/com/hellojourney/controller/SettingsControllerTest.java`
4. 类名旁边有个绿色 ▶ → 点 **Run 'SettingsControllerTest'**。
   - 想跑全部：右键 `src/test/java` → **Run 'All Tests'**。
5. 结果看下面的 **Run** 面板：绿色勾 = 通过，红色 = 失败，点失败项会直接跳到断言行。

> 在 IDE 里跑不需要联网（依赖已下载），也不会受 `JAVA_HOME` 影响 —— IDE 用的是它自己配的 JDK。

---

## 方法三（命令行党）：两条命令

```bat
set "JAVA_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2023.3.6\jbr"
cd /d D:\lfw-code\HelloJourney\backend
"C:\Program Files\JetBrains\IntelliJ IDEA 2023.3.6\plugins\maven\lib\maven3\bin\mvn.cmd" test
```

只想跑某个类（注意是类名通配，多个用逗号）：

```bat
"...\mvn.cmd" "-Dtest=*Settings*" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

---

## 怎么看结果

```
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

- **Tests run**：跑了几个用例
- **Failures**：断言失败（代码行为不符合预期）
- **Errors**：抛异常（环境/依赖/上下文问题，比如找不到 Bean）
- **BUILD SUCCESS**：全绿；**BUILD FAILURE**：有失败，往下翻 `[ERROR]` 行

详细报告在 `backend/target/surefire-reports/*.txt`，某个类报错就打开对应 txt 看堆栈第一行的 `Caused by`。

---

## 这次我顺手修掉的两个"测试本身坏了"的问题

跑测试时发现有三个测试类**在我改代码之前就是红的**（都是别人后来加功能时忘了同步测试）：

1. `SettingsControllerTest`：`SettingsController` 后来加了 `XhsService` 依赖，测试类没加 `@MockBean` → 整个 Spring 上下文起不来，9 个用例全部 `Error`（不是断言失败，是环境起不来）。
2. `PoiControllerTest`：同样原因，`PoiController` 后来加了 `XhsImageProxyService`，测试没同步 → 6 个用例 `Error`。
3. `TripPlanningJobServiceTest`：`planTripWithReview` 后来加了第四个参数 `warnings`，但测试还在桩**三参数**版本 → Mockito 报 `PotentialStubbingProblem`。

`@WebMvcTest` 只装 Web 层，**不会**自动装配 `@Service`，所以控制器依赖的每个 Service 都必须在测试里显式 `@MockBean` —— 这是这三处根因的共同点。

修完之后，整个后端测试套件是绿的：

```
[INFO] Tests run: 167, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

单独跑带 `Settings` 的类：

```
[INFO] Tests run: 23, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

你自己按方法一/二再跑一遍，看到 `BUILD SUCCESS` 就说明环境没问题了。

---

## 常见报错对照

| 报错 | 含义 | 处理 |
| --- | --- | --- |
| `No qualifying bean of type 'com.hellojourney.service.XhsService'` | 测试上下文缺 `@MockBean` | 在测试类里补一个 `@MockBean` |
| `JAVA_HOME not set correctly` | `JAVA_HOME` 指向的目录没有 `bin\java.exe` | 用方法一/二，或改成真正的 JDK 目录 |
| `Could not resolve dependencies` | 离线且本地仓库缺包 | 联网跑一次 `mvn test`，或让 IDE 下载 |
| `Port 8080 already in use` | 用 `mvn spring-boot:run` 起了两个服务 | 先关掉旧的 |

---

## 附：前端测试怎么跑（同一套思路）

```bat
cd /d D:\lfw-code\HelloJourney\frontend
npm run test          :: 跑一次
npm run test:watch    :: 改代码自动重跑
npm run typecheck     :: 只做类型检查
npm run lint          :: 代码规范
```
