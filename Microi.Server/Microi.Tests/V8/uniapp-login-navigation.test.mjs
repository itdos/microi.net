// 移动端登录压栈修复复用责任源码旁的行为回归，由统一自动发现入口执行。
import test from 'node:test'
import '../../../microi.uniapp/scripts/test-login-navigation.mjs'
import '../../../microi.uniapp/scripts/test-auth-expired-policy.mjs'

void test
