<template>
  <view class="uni-container">
    <view class="list">
      <view class="list-item" v-if="detail && checkPoint">
        <view class="uni-flex uni-justify-between uni-common-mb-xs">
          <view class="list-item-name">
            {{ detail.LaiyuanJH }}
          </view>
          <view class="list-item-progress"
          :class="{ 'Ongoing': detail.Zhuangtai == '进行中', 'Expired': detail.Zhuangtai == '过期未完成' || detail.Zhuangtai == '已作废' }">
            {{ detail.Zhuangtai }}
          </view>
        </view>
        <view class="list-item-desc uni-common-mb">
          {{ detail.JianchaKSSJ }} ~ {{ detail.JianchaJSSJ }}
        </view>
        <view class="uni-flex uni-flex-wrap uni-common-mb-xs">
          <view class="list-item-tag" v-for="(tag, index) in checkPoint" :key="index"
            @click="scrollToSection('sectionId' + index)">
            <uni-icons :type="tag.TibaoWB ? 'checkbox-filled' : 'circle'" size="22" color="#3579F4"
              class="uni-common-mr-xs"></uni-icons>
            <text>{{ tag.Quyu }}</text>
          </view>
        </view>
        <view class="Divider"></view>
      </view>
      <view class="content" v-for="(tag, index) in checkPoint" :key="index">
        <view :id="'sectionId' + index">
          <view @click="tag.show = !tag.show" class="uni-flex uni-justify-between uni-common-mb">
            <view class="content-title">{{ tag.Quyu }}</view>
            <view class="content-triangle">
              <view class="content-triangle-down" v-if="tag.show"></view>
              <view class="content-triangle-up" v-else></view>
            </view>
          </view>
        </view>
        <view @click="changeScan(tag)" class="uni-flex uni-justify-between uni-common-mb uni-flex-align-center"
          v-if="checkPlan.JianchaDGW && Zhuangtai == 0">
          <view class="content-saoma">
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="17"
              height="34.97119140625" viewBox="0 0 34 34.97119140625" fill="none">
              <path
                d="M31.5229 17.8014C31.5119 17.7901 31.5007 17.779 31.4892 17.7681C31.4776 17.7573 31.4658 17.7468 31.4538 17.7366C31.4417 17.7264 31.4294 17.7165 31.4169 17.7069C31.4043 17.6974 31.3915 17.6881 31.3785 17.6792C31.3654 17.6703 31.3522 17.6617 31.3387 17.6534C31.3252 17.6452 31.3116 17.6373 31.2977 17.6297C31.2838 17.6222 31.2698 17.615 31.2556 17.6082C31.2413 17.6013 31.2269 17.5949 31.2123 17.5888C31.1978 17.5827 31.183 17.5769 31.1682 17.5716C31.1533 17.5662 31.1383 17.5613 31.1232 17.5567C31.1081 17.5521 31.0929 17.5479 31.0775 17.5441C31.0622 17.5403 31.0468 17.5369 31.0313 17.5339C31.0158 17.5308 31.0002 17.5282 30.9846 17.526C30.9689 17.5238 30.9532 17.522 30.9375 17.5205C30.9218 17.5191 30.906 17.5181 30.8902 17.5175C30.8744 17.5168 30.8587 17.5166 30.8429 17.5168C30.5903 17.5168 30.3445 17.6237 30.1648 17.8014L28.4318 19.55L32.0863 23.2317L33.7183 21.3763C33.7295 21.3652 33.7403 21.3538 33.7509 21.3422C33.7615 21.3306 33.7719 21.3187 33.7819 21.3065C33.7919 21.2944 33.8016 21.282 33.811 21.2693C33.8203 21.2567 33.8294 21.2438 33.8382 21.2307C33.847 21.2177 33.8554 21.2044 33.8635 21.1909C33.8716 21.1774 33.8794 21.1637 33.8869 21.1498C33.8943 21.136 33.9013 21.1219 33.9081 21.1077C33.9148 21.0935 33.9212 21.079 33.9272 21.0645C33.9332 21.0499 33.9389 21.0353 33.9442 21.0204C33.9495 21.0056 33.9544 20.9906 33.959 20.9756C33.9636 20.9605 33.9677 20.9454 33.9716 20.9301C33.9754 20.9148 33.9788 20.8994 33.9819 20.884C33.9849 20.8685 33.9876 20.853 33.9899 20.8375C33.9922 20.8219 33.9941 20.8063 33.9956 20.7906C33.9971 20.7749 33.9982 20.7592 33.999 20.7435C33.9997 20.7278 34 20.7121 34 20.6963C34 20.4398 33.8932 20.1931 33.7183 20.0163L31.5229 17.8014ZM19.5714 13.904L9.02457 13.904C8.99018 13.904 8.95586 13.903 8.92154 13.9012C8.88722 13.8994 8.85294 13.8968 8.81877 13.8933C8.78456 13.8898 8.75045 13.8855 8.7165 13.8803C8.6825 13.8752 8.64865 13.8692 8.61498 13.8624C8.58127 13.8556 8.54779 13.8479 8.51448 13.8395C8.48117 13.831 8.44807 13.8217 8.4152 13.8116C8.38232 13.8015 8.34973 13.7907 8.31743 13.779C8.2851 13.7673 8.25308 13.7549 8.2214 13.7416C8.18967 13.7283 8.15827 13.7143 8.12727 13.6995C8.09623 13.6847 8.06559 13.6692 8.03535 13.6528C8.00507 13.6366 7.97522 13.6195 7.9458 13.6018C7.91639 13.584 7.8874 13.5655 7.85889 13.5463C7.83037 13.5271 7.80236 13.5073 7.77482 13.4867C7.74728 13.4661 7.72024 13.4449 7.69375 13.423C7.66725 13.4012 7.64129 13.3786 7.61592 13.3554C7.5905 13.3323 7.5657 13.3085 7.54147 13.2841C7.51725 13.2597 7.49364 13.2348 7.47064 13.2092C7.44764 13.1837 7.42529 13.1576 7.40359 13.1309C7.38185 13.1043 7.3608 13.0771 7.34043 13.0495C7.32002 13.0218 7.30031 12.9937 7.28134 12.965C7.26231 12.9364 7.24403 12.9073 7.22648 12.8777C7.20889 12.8482 7.19201 12.8182 7.17594 12.7879C7.15982 12.7575 7.14447 12.7268 7.1299 12.6956C7.11527 12.6645 7.10146 12.6331 7.08841 12.6013C7.07536 12.5695 7.0631 12.5374 7.05164 12.505C7.04014 12.4726 7.02947 12.4399 7.01963 12.407C7.00975 12.3741 7.00067 12.3409 6.99245 12.3075C6.98419 12.2742 6.97677 12.2406 6.97017 12.2069C6.96357 12.1732 6.9578 12.1393 6.9529 12.1053C6.94793 12.0713 6.94385 12.0372 6.94061 12.0029C6.93733 11.9687 6.93491 11.9344 6.93336 11.9001C6.93178 11.8658 6.93102 11.8314 6.93116 11.797C6.93102 11.7626 6.9317 11.7283 6.93325 11.6939C6.9348 11.6596 6.93718 11.6253 6.94043 11.5911C6.94364 11.5568 6.94771 11.5227 6.95265 11.4887C6.95755 11.4546 6.96328 11.4208 6.96984 11.387C6.9764 11.3533 6.98383 11.3197 6.99205 11.2863C7.00027 11.2529 7.00932 11.2198 7.0192 11.1868C7.02904 11.1539 7.03967 11.1213 7.05113 11.0888C7.0626 11.0564 7.07485 11.0243 7.0879 10.9925C7.10092 10.9607 7.11473 10.9292 7.12932 10.898C7.14389 10.8669 7.15925 10.8362 7.17536 10.8058C7.19144 10.7754 7.20827 10.7454 7.22586 10.7159C7.24342 10.6864 7.2617 10.6573 7.28073 10.6286C7.29973 10.6 7.31941 10.5718 7.33982 10.5441C7.36018 10.5164 7.38124 10.4892 7.40297 10.4626C7.42468 10.4359 7.44706 10.4098 7.47006 10.3843C7.49306 10.3587 7.51667 10.3338 7.54093 10.3094C7.56516 10.285 7.58996 10.2612 7.61538 10.238C7.64075 10.2149 7.66671 10.1923 7.69324 10.1704C7.71974 10.1485 7.74677 10.1273 7.77432 10.1068C7.80186 10.0862 7.8299 10.0663 7.85845 10.0471C7.88697 10.0279 7.91595 10.0095 7.94541 9.9917C7.97482 9.97396 8.00467 9.95691 8.03495 9.94062C8.06523 9.92432 8.09587 9.90878 8.12691 9.894C8.15795 9.87922 8.18935 9.8652 8.22107 9.85194C8.2528 9.83871 8.28481 9.82623 8.31718 9.81455C8.34948 9.80291 8.3821 9.79206 8.41498 9.78196C8.44786 9.77191 8.48095 9.76264 8.5143 9.75421C8.54761 9.74577 8.58113 9.73816 8.61484 9.73135C8.64854 9.72457 8.68239 9.71859 8.71639 9.71347C8.75038 9.70835 8.78448 9.70406 8.8187 9.7006C8.85287 9.69714 8.88715 9.69454 8.92151 9.69278C8.95583 9.69101 8.99018 9.69007 9.02457 9.69L19.5724 9.69C20.7293 9.69 21.6658 10.6342 21.6658 11.798C21.6659 11.8324 21.6652 11.8667 21.6636 11.901C21.6621 11.9354 21.6597 11.9697 21.6564 12.0039C21.6532 12.0381 21.6491 12.0722 21.6442 12.1062C21.6392 12.1403 21.6335 12.1741 21.6269 12.2079C21.6203 12.2416 21.6129 12.2752 21.6047 12.3085C21.5964 12.3419 21.5874 12.375 21.5776 12.408C21.5677 12.4409 21.557 12.4736 21.5455 12.5059C21.5341 12.5384 21.5218 12.5704 21.5088 12.6022C21.4957 12.634 21.4819 12.6655 21.4673 12.6966C21.4527 12.7278 21.4374 12.7585 21.4213 12.7889C21.4051 12.8192 21.3883 12.8492 21.3707 12.8787C21.3532 12.9083 21.3349 12.9373 21.3159 12.966C21.2968 12.9946 21.2772 13.0227 21.2568 13.0504C21.2364 13.0781 21.2153 13.1053 21.1936 13.1319C21.1719 13.1585 21.1495 13.1846 21.1265 13.2101C21.1035 13.2357 21.0799 13.2606 21.0557 13.285C21.0315 13.3094 21.0066 13.3332 20.9812 13.3563C20.9558 13.3795 20.9299 13.402 20.9034 13.4239C20.8769 13.4458 20.8498 13.467 20.8223 13.4875C20.7948 13.5081 20.7667 13.5279 20.7382 13.5471C20.7096 13.5663 20.6807 13.5848 20.6513 13.6025C20.6218 13.6203 20.592 13.6373 20.5617 13.6536C20.5314 13.6699 20.5008 13.6854 20.4698 13.7002C20.4387 13.715 20.4074 13.729 20.3756 13.7422C20.3439 13.7554 20.3119 13.7679 20.2796 13.7796C20.2472 13.7912 20.2146 13.8021 20.1818 13.8121C20.1489 13.8222 20.1158 13.8314 20.0825 13.8399C20.0492 13.8483 20.0157 13.8559 19.982 13.8627C19.9483 13.8695 19.9144 13.8755 19.8805 13.8806C19.8464 13.8857 19.8124 13.89 19.7782 13.8934C19.744 13.8969 19.7097 13.8995 19.6754 13.9013C19.6411 13.9031 19.6067 13.904 19.5724 13.904L19.5714 13.904ZM15.3321 22.3827L9.0236 22.3827C8.98921 22.3826 8.95485 22.3816 8.92053 22.3798C8.88618 22.378 8.8519 22.3754 8.81772 22.3719C8.78351 22.3684 8.74941 22.3641 8.71541 22.3589C8.68142 22.3538 8.64757 22.3478 8.6139 22.341C8.58016 22.3342 8.54667 22.3266 8.51336 22.318C8.48001 22.3096 8.44692 22.3003 8.41408 22.2902C8.3812 22.2802 8.34858 22.2693 8.31628 22.2576C8.28391 22.2459 8.25189 22.2334 8.22017 22.2201C8.18845 22.2069 8.15705 22.1928 8.12605 22.178C8.09501 22.1632 8.06437 22.1477 8.03412 22.1313C8.00384 22.1151 7.97399 22.098 7.94458 22.0802C7.91512 22.0625 7.88614 22.044 7.85763 22.0247C7.82907 22.0056 7.80106 21.9857 7.77352 21.9651C7.74598 21.9445 7.71894 21.9233 7.69245 21.9014C7.66592 21.8795 7.64 21.8569 7.61462 21.8338C7.5892 21.8106 7.5644 21.7868 7.54018 21.7624C7.51595 21.738 7.49234 21.713 7.46934 21.6875C7.44634 21.6619 7.42395 21.6358 7.40225 21.6091C7.38052 21.5825 7.35946 21.5553 7.33909 21.5276C7.31869 21.4999 7.29901 21.4718 7.28001 21.4431C7.26101 21.4145 7.24274 21.3854 7.22514 21.3558C7.20755 21.3263 7.19072 21.2963 7.17464 21.2659C7.15852 21.2356 7.14317 21.2048 7.1286 21.1736C7.114 21.1425 7.1002 21.111 7.08718 21.0792C7.07413 21.0474 7.06188 21.0153 7.05041 20.9829C7.03895 20.9505 7.02828 20.9178 7.0184 20.8849C7.00852 20.8519 6.99948 20.8188 6.99126 20.7854C6.98304 20.752 6.97561 20.7184 6.96905 20.6847C6.96245 20.651 6.95669 20.6171 6.95178 20.583C6.94684 20.549 6.94277 20.5149 6.93953 20.4806C6.93628 20.4464 6.93387 20.4121 6.93232 20.3778C6.93077 20.3435 6.93005 20.3091 6.93019 20.2747C6.93005 20.2403 6.93077 20.206 6.93232 20.1716C6.93387 20.1373 6.93628 20.103 6.93953 20.0688C6.94277 20.0346 6.94684 20.0005 6.95178 19.9665C6.95669 19.9324 6.96245 19.8986 6.96905 19.8648C6.97561 19.8311 6.98304 19.7976 6.99129 19.7642C6.99951 19.7308 7.00856 19.6977 7.01844 19.6647C7.02828 19.6318 7.03895 19.5991 7.05045 19.5667C7.06191 19.5344 7.07417 19.5022 7.08722 19.4705C7.10027 19.4387 7.11408 19.4072 7.12868 19.3761C7.14324 19.345 7.1586 19.3142 7.17471 19.2838C7.19079 19.2535 7.20762 19.2236 7.22522 19.194C7.24281 19.1645 7.26108 19.1354 7.28008 19.1067C7.29908 19.0781 7.31876 19.0499 7.33917 19.0223C7.35957 18.9946 7.38062 18.9675 7.40236 18.9408C7.42406 18.9142 7.44641 18.8881 7.46945 18.8625C7.49245 18.837 7.51606 18.8121 7.54029 18.7876C7.56451 18.7633 7.58931 18.7395 7.61473 18.7164C7.6401 18.6932 7.66606 18.6707 7.69259 18.6488C7.71909 18.6269 7.74613 18.6057 7.77367 18.5852C7.80121 18.5646 7.82922 18.5447 7.85777 18.5256C7.88628 18.5064 7.91527 18.4879 7.94472 18.4702C7.97414 18.4524 8.00398 18.4354 8.03427 18.4191C8.06451 18.4028 8.09515 18.3873 8.12619 18.3725C8.15723 18.3577 8.18859 18.3437 8.22032 18.3305C8.25204 18.3173 8.28405 18.3048 8.31639 18.2931C8.34872 18.2815 8.38131 18.2706 8.41419 18.2605C8.44706 18.2505 8.48016 18.2412 8.51347 18.2328C8.54678 18.2244 8.5803 18.2168 8.61401 18.21C8.64768 18.2032 8.68153 18.1972 8.71552 18.1921C8.74948 18.187 8.78358 18.1827 8.81779 18.1792C8.85197 18.1758 8.88625 18.1732 8.92057 18.1714C8.95489 18.1697 8.98921 18.1687 9.0236 18.1686L15.3321 18.1686C16.4881 18.1686 17.4255 19.1128 17.4255 20.2756C17.4256 20.31 17.4249 20.3444 17.4234 20.3787C17.4219 20.4131 17.4195 20.4474 17.4162 20.4816C17.413 20.5158 17.4089 20.55 17.404 20.584C17.3991 20.618 17.3934 20.6519 17.3868 20.6857C17.3802 20.7194 17.3728 20.753 17.3646 20.7864C17.3564 20.8197 17.3473 20.8529 17.3375 20.8858C17.3276 20.9188 17.3169 20.9515 17.3055 20.9839C17.2941 21.0163 17.2818 21.0484 17.2688 21.0802C17.2557 21.112 17.2419 21.1435 17.2273 21.1746C17.2127 21.2057 17.1974 21.2365 17.1813 21.2669C17.1652 21.2973 17.1483 21.3272 17.1308 21.3568C17.1132 21.3864 17.0949 21.4154 17.0759 21.4441C17.0569 21.4728 17.0372 21.5009 17.0168 21.5286C16.9964 21.5563 16.9754 21.5835 16.9537 21.6101C16.9319 21.6368 16.9096 21.6629 16.8866 21.6884C16.8636 21.714 16.84 21.739 16.8158 21.7633C16.7915 21.7877 16.7667 21.8115 16.7413 21.8346C16.7159 21.8578 16.6899 21.8804 16.6634 21.9023C16.6369 21.9242 16.6099 21.9454 16.5823 21.9659C16.5548 21.9865 16.5268 22.0064 16.4982 22.0255C16.4697 22.0448 16.4407 22.0632 16.4113 22.081C16.3818 22.0988 16.352 22.1158 16.3217 22.1321C16.2914 22.1484 16.2607 22.1639 16.2297 22.1787C16.1987 22.1935 16.1673 22.2075 16.1356 22.2207C16.1039 22.234 16.0718 22.2465 16.0395 22.2581C16.0071 22.2698 15.9746 22.2807 15.9417 22.2907C15.9088 22.3008 15.8757 22.31 15.8424 22.3185C15.809 22.3269 15.7755 22.3346 15.7418 22.3413C15.7081 22.3481 15.6742 22.3541 15.6403 22.3592C15.6062 22.3643 15.5721 22.3686 15.538 22.3721C15.5038 22.3755 15.4695 22.3782 15.4351 22.3799C15.4008 22.3817 15.3664 22.3826 15.3321 22.3827ZM24.3829 0L5.08156 0C2.27703 0 0 2.29259 0 5.12135L0 29.85C0 32.6788 2.27703 34.9714 5.08156 34.9714L12.1021 34.9714L12.1021 30.3824L29.4703 12.478L29.4703 5.12525C29.4703 2.29645 27.1922 0 24.3829 0ZM16.6843 31.2897L16.6843 34.9714L20.3476 34.9714L30.9322 24.1925L27.2777 20.502L16.6853 31.2897L16.6843 31.2897Z"
                fill="#999999">
              </path>
            </svg>
            <text class="uni-common-ml-xs">待检工位：{{ Object.keys(tag.groupedByName).length }}</text>
          </view>
          <view class="progress-box">
            <div class="progress-bar-container">
              <div class="progress-bar"
                :style="{ width: progressWidth(calculateProgress_Fenzhi(tag.groupedByName)) + '%' }"></div>
            </div>
            <view class="progress-text">{{ calculateProgress_Fenzhi(tag.groupedByName) }}</view>
          </view>
          <uni-icons type="scan" size="22" color="#3579F4"></uni-icons>
        </view>
        <view v-if="tag.show">
          <!-- 如果需要扫码 -->
           <block v-if="checkPlan.JianchaDGW">
            <view v-for="(gonweiItme, index) in tag.checkXNew" :key="index">
              <view class="uni-common-mb" @click="onGW(gonweiItme)" :id="'gw' + index">
                <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="14" height="10"
                  viewBox="0 0 16.6201171875 23.72998046875" fill="none">
                  <path style="mix-blend-mode:normal" fill="#555555" d="M0 -7.62939e-06L16.62 11.87L0 23.73">
                  </path>
                </svg>
                工位号 {{ index }}
                <text>({{ calculateProgress(tag.groupedByName[index].checkX, 'Fenzhi') }})</text> 
              </view>
              <view v-if="gonweiItme.show">
                <view class="content-desc uni-flex uni-justify-between" v-for="(item, index) in gonweiItme.checkX"
                  :key="index">
                  <!-- <view class="content-desc uni-flex uni-justify-between" v-for="(item, index) in tag.checkXNew" :key="index"> -->
                  <view class="content-desc-left">
                    <view class="drop"></view>
                    <view class="line"></view>
                  </view>
                  <view class="content-desc-right">
                    <view class="content-desc-right-item ">
                      <view class="content-desc-right-item-title">
                        <text v-html="item.JianchaFL"></text>
                      </view>
                      <view class="content-desc-right-item-text">
                        <text v-html="item.JianchaX"></text>
                      </view>
                    </view>
                    <view v-if="item.Fenzhi && (checkPlan.BixuSCZP || checkPlan.ZhinengPZJC)">
                      <view class="Divider"></view>
                      <view class="uni-common-p">
                        <view class="uni-flex uni-flex-wrap">
                          <block v-for="(img, index1) in item.Tupian" :key="index1">
                            <image slot='cover' :src="img.url" class="item-TupianFK"
                              @click.stop="previewImg(item.Tupian, index1)" />
                          </block>
                        </view>
                      </view>
                    </view>

                    <!-- 需要上传图片或拍照 -->
                    <view v-if="item.isPaiZhaoShow && !item.Fenzhi && Zhuangtai == 0">
                      <view class="Divider"></view>
                      <view class="uni-common-p">
                        <uni-file-picker v-model="item.Tupian" file-mediatype="image" :imageStyles="imageStyles"
                          :sourceType="checkPlan.ZhinengPZJC ? ['camera'] : ['album', 'camera']"
                          @select="upFileSelect($event, tag, item)" @delete="upFileDelete($event, tag, item)">
                          <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
                        </uni-file-picker>
                      </view>
                    </view>
                    <view class=""
                      v-if="(checkPlan.BixuSCZP || checkPlan.ZhinengPZJC) && !item.Fenzhi && !item.isPaiZhaoShow">
                      <view class="Divider"></view>
                      <uni-file-picker file-mediatype="image" mode="list"
                        :sourceType="checkPlan.ZhinengPZJC ? ['camera'] : ['album', 'camera']"
                        @select="upFileSelect($event, tag, item)">
                        <view class="uni-flex uni-flex-align-center uni-common-p-xs uni-justify-center ">
                          <uni-icons type="camera-filled" size="32" color="#3579F6"></uni-icons>
                          <text class="text-tips">检查评分</text>
                        </view>
                      </uni-file-picker>
                    </view>
                    <view class="" v-else>
                      <view class="Divider"></view>
                      <view class="uni-flex uni-flex-align-center uni-common-p radio-item" v-if="itemsRadio.length > 0">
                        <block v-for="(radio, index) in itemsRadio" :key="index">
                          <view class="item-radio" :class="{ 'item-radio-active': item.Fenzhi == radio.Defen }"
                            v-if="item.Fenzhi">{{ radio.Defen }}</view>
                          <view class="item-radio" :class="{ 'item-radio-active': item.Defen == radio.Defen }" v-else
                            @click="radioChange(radio, tag, item)">{{ radio.Defen }}</view>
                        </block>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </block>
          <block v-else>
            <view>
              <view>
                <view class="content-desc uni-flex uni-justify-between" v-for="(item, index) in tag.checkXNew"
                  :key="index">
                  <view class="content-desc-left">
                    <view class="drop"></view>
                    <view class="line"></view>
                  </view>
                  <view class="content-desc-right">
                    <view class="content-desc-right-item ">
                      <view class="content-desc-right-item-title">
                        <text v-html="item.JianchaFL"></text>
                      </view>
                      <view class="content-desc-right-item-text">
                        <text v-html="item.JianchaX"></text>
                      </view>
                    </view>
                    <view v-if="item.Fenzhi">
                      <view class="Divider"></view>
                      <view class="uni-common-p">
                        <view class="uni-flex uni-flex-wrap">
                          <block v-for="(img, index1) in item.Tupian" :key="index1">
                            <image slot='cover' :src="img.url" class="item-TupianFK"
                              @click.stop="previewImg(item.Tupian, index1)" />
                          </block>
                        </view>
                      </view>
                    </view>

                    <!-- 需要上传图片或拍照 -->
                    <view v-if="item.isPaiZhaoShow && !item.Fenzhi && Zhuangtai == 0">
                      <view class="Divider"></view>
                      <view class="uni-common-p">
                        <uni-file-picker v-model="item.Tupian" file-mediatype="image" :imageStyles="imageStyles"
                          :sourceType="checkPlan.ZhinengPZJC ? ['camera'] : ['album', 'camera']"
                          @select="upFileSelect($event, tag, item)" @delete="upFileDelete($event, tag, item)">
                          <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
                        </uni-file-picker>
                      </view>
                    </view>
                    <view class=""
                      v-if="(checkPlan.BixuSCZP || checkPlan.ZhinengPZJC) && !item.Fenzhi && !item.isPaiZhaoShow">
                      <view class="Divider"></view>
                      <uni-file-picker file-mediatype="image" mode="list"
                        :sourceType="checkPlan.ZhinengPZJC ? ['camera'] : ['album', 'camera']"
                        @select="upFileSelect($event, tag, item)">
                        <view class="uni-flex uni-flex-align-center uni-common-p-xs uni-justify-center ">
                          <uni-icons type="camera-filled" size="32" color="#3579F6"></uni-icons>
                          <text class="text-tips">检查评分</text>
                        </view>
                      </uni-file-picker>
                    </view>
                    <view class="" v-else>
                      <view class="Divider"></view>
                      <view class="uni-flex uni-flex-align-center uni-common-p radio-item" v-if="itemsRadio.length > 0">
                        <block v-for="(radio, index) in itemsRadio" :key="index">
                          <view class="item-radio" :class="{ 'item-radio-active': item.Fenzhi == radio.Defen }"
                            v-if="item.Fenzhi">{{ radio.Defen }}</view>
                          <view class="item-radio" :class="{ 'item-radio-active': item.Defen == radio.Defen }" v-else
                            @click="radioChange(radio, tag, item)">{{ radio.Defen }}</view>
                        </block>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </block>
        </view>
      </view>
    </view>
    <view class="sub-btn" v-if="Zhuangtai == 0">
      <button type="primary" :loading="isLoading" @click="submit">提交</button>
    </view>
  </view>
</template>
<script setup>
import { ref, onMounted, inject } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { calculateProgress, changeTu } from './public.js'
import { previewImg, GetServerPath, scanCodeH5, uploadFile } from '@/utils'
import { useStore } from 'vuex';
const store = useStore();
const Microi = inject('Microi')
const detail = ref({})
const swiperDotIndex = ref(0)
const current = ref(0)
const itemsRadio = ref([])
const imageStyles = {
  width: 75,
  height: 75,
  "border": { // 如果为 Boolean 值，可以控制边框显示与否
    "color": "#eee",		// 边框颜色
    "width": "1px",		// 边框宽度
    "style": "solid", 	// 边框样式
    "radius": "20%" 		// 边框圆角，支持百分比
  }
}
const checkPoint = ref([]) // 风险点列表
const checkPlan = ref({}) // 计划详情
const isLoading = ref(false)
const TableId = '16f50820-78ea-4fc6-ab90-56b5a8b0a68b'
const Zhuangtai = ref(0)
const clickItem = (e) => {
  swiperDotIndex.value = e
}
const change = (e) => {
  current.value = e.detail.current
}
// 点击风险点滚动到对应位置
const scrollToSection = (sectionId) => {
  console.log(sectionId, '滚动到对应位置')
  const query = uni.createSelectorQuery().in(this); // 确保选择器是在当前组件上下文中
    query.select(`#${sectionId}`).boundingClientRect(rect => {
      console.log(rect, '元素位置');
      if (rect) {
        uni.pageScrollTo({
          scrollTop: rect.top,
          duration: 300 // 滚动动画持续时间，单位 ms
        });
      } else {
        console.error(`未找到ID为'${sectionId}'的元素`);
      }
    }).exec(); // 执行选择器查询
}
// 计算扫工位进度
const calculateProgress_Fenzhi = (e) => {
  let len = Object.keys(e).length
  let count = 0
  for (const key in e) {
    const item = e[key]
    // 计算item.checkX中Fenzhi是否全部填写完毕
    if (item.checkX && item.checkX.every(i => i.Fenzhi)) {
      count += 1
      break
    }
  }
  return count + '/' + len
}
// 计算进度条宽度
const progressWidth = (e) => {
  const progress = e.split('/')
  const width = progress[0] / progress[1] * 100
  return width
}
// 储存数据
const saveData = (formData, Name, tag, item) => {
  const obj = {
    TableId: TableId,
    Id: item.Id,
    _FormData: {
      ...formData
    }
  }
  store.commit('tableEdit/SET_CHILD_TABLE_DATA_EDIT', { obj: obj, Name: Name, parentId: detail.value.Id, Guid: tag.Id })
}
// 单选框
const radioChange = async (e, tag, item) => {
  item.Defen = e.Defen
  saveData({ Fenzhi: e.Defen }, 'Fenzhi', tag, item)
  saveData({ HegeBHG: e.Biaoji }, 'HegeBHG', tag, item)
}

// 文件上传
const upFileSelect = async (e, tag, item) => {
  item.isPaiZhaoShow = true
  const res = await uploadFile(e.tempFilePaths, { Component: 'ImgUpload' })
  if (res.Code == 1) {
    // 如果有值，就追加，没有就赋值
    if (item.Tupian) {
      item.Tupian = [...item.Tupian, ...res.Data]
    } else {
      item.Tupian = res.Data
    }
  }
  saveData({ Tupian: JSON.stringify(item.Tupian) }, 'Tupian', tag, item)
}

// 文件删除
const upFileDelete = (e, tag, item) => {
  const index = item.Tupian?.findIndex(item => item.Url == e.url)
  if (index > -1) {
    item.Tupian.splice(index, 1)
  }
  saveData({ Tupian: JSON.stringify(item.Tupian) }, 'Tupian', tag, item)
}
// 是否显示工位
const onGW = (e) => {
  e.show = !e.show
}
// 获取列表数据
const getListData = async () => {
  checkPlan.value = detail.value.plan
  itemsRadio.value = detail.value.DaAnArray // 单选框分值
  // 区域检查项
  checkPoint.value = detail.value.checkPoint.map(item => {
    if (item.TibaoWB) {
      item.show = false
    } else {
      item.show = true
    }
    item.checkX = item.checkX.map(item1 => {
      item1.Tupian = changeTu(item1.Tupian)
      // item1.isPaiZhaoShow = Zhuangtai.value == 0 ? false : true
      item1.isPaiZhaoShow = true
      return item1
    })
    /* 检查工位项
      如果需要扫工位码，则显示处理检查项数据
      根据工位码 分组
      查看是否有提报过的工位检查数据，如果有，则显示处理检查项数据
    */
    const groupedByName = item.checkX.reduce((acc, item) => {
      // 如果分组中还没有当前名字的键，则创建一个数组
      if (!acc[item.GWBH]) {
        acc[item.GWBH] = {
          show: true,
          checkX: []
        };
      }
      // 将当前项添加到对应名字的数组中
      acc[item.GWBH] = {
        ...acc[item.GWBH],
        checkX: [...acc[item.GWBH].checkX, item]
      };
      return acc;
    }, {});
    item.groupedByName = JSON.parse(JSON.stringify(groupedByName))
    if (checkPlan.value.JianchaDGW) {
      // 获取分组后的填写过分值的数据
      for (const key in groupedByName) {
        groupedByName[key].checkX = groupedByName[key].checkX.filter(i => i.Fenzhi)
        // 如果该工位下没有填写过分值，则删除分组
        if (groupedByName[key].checkX.length <= 0) {
          delete groupedByName[key]
        }
      }
      item.checkXNew = groupedByName
    } else {
      item.checkXNew = item.checkX
    }
    return item
  })
  console.log('检查项',checkPoint.value)
  // 设置子表必填项
  const requiredData = ['Fenzhi']
  if (checkPlan.value.BixuSCZP || checkPlan.value.ZhinengPZJC) {
    requiredData.push('Tupian')
  }
  store.commit('tableEdit/SET_CHILD_TABLE_REQUIRED', { requiredData: requiredData, TableId: TableId })
  // 周末不执行
  if (checkPlan.value.ZhoumoBZH && (new Date().getDay() == 0 || new Date().getDay() == 6)) {
    uni.showModal({
      title: '提示',
      content: '周末不执行',
      showCancel: false,
      success: function (res) {
        if (res.confirm) {
          console.log('用户点击确定');
          uni.navigateBack()
        } else if (res.cancel) {
          console.log('用户点击取消');
        }
      }
    });
  }
  Microi.HideLoading()
}
// 扫码验证
const changeScan = async (tag) => {
  const code = await scanCodeH5()
  if (!tag.groupedByName[code]) {
    Microi.Tips('工位码不存在', false)
    return
  }
  // 先查看tag.groupedByName[code].checkX中数据全部填写完毕，则提示已扫码
  if (tag.groupedByName[code].checkX.every(item => item.Fenzhi)) {
    Microi.Tips('该工位任务已完成', false)
    return
  }
  // 过滤tag.groupedByName[code].checkX未填写的数据
  const arr = tag.groupedByName[code].checkX.filter(item => !item.Fenzhi)
  // 遍历未填写的数据，将数据插入到tag.checkXNew最前面
  if (arr.length > 0) {
    if (tag.checkXNew[code] && tag.checkXNew[code].hasOwnProperty('checkX')) {
      tag.checkXNew[code] = {
        show: true,
        checkX: new Set([...arr, ...tag.checkXNew[code].checkX])
      }
    } else {
      tag.checkXNew[code] = {
        show: true,
        checkX: arr
      }
    }
    Microi.Tips('扫码成功', true)
    setTimeout(() => {
      scrollToSection('gw' + code)
    }, 1000)
  } else {
    Microi.Tips('工位码不存在或已扫码', false)
  }


  // 先过滤tag.checkX中与tag.checkXNew相等的数据
  // const checkX = tag.checkX.filter(itemA => !tag.checkXNew.some(itemB => itemB.Id === itemA.Id));
  // // 再过滤tag.checkX中GWBH是否有与code值相等，则给tag.checkXNew最前面插入数据
  // const arr = checkX.filter(item => item.GWBH == code)
  // if (arr.length > 0) {
  //   tag.checkXNew = new Array(...arr, ...tag.checkXNew)
  //   Microi.Tips('扫码成功', true)
  // } else {
  //   Microi.Tips('工位码不存在或已扫码', false)
  // }
}

// 提交
const submit = async () => {
  isLoading.value = true
  let hasMissingData = false; // 用于跟踪是否有缺失的数据
  const { Child_TableData_Edit, Child_Table_Required } = store.state.tableEdit
  const currentFormChild = Child_TableData_Edit[detail.value.Id]
  if (!currentFormChild) {
    Microi.Tips('请填写检查评分', false)
    isLoading.value = false
    hasMissingData = true; // 标记有缺失的数据
    return
  }
  const combinedArray = Object.values(currentFormChild).reduce((acc, val) => acc.concat(val), []);
  // 检查必填项是否都有值
  const requiredData = Child_Table_Required[TableId]
  // 检查必填项是否填写，没有则提示哪一项没填
  requiredData.forEach(element => {
    combinedArray.forEach(child => {
      if (!child._FormData[element]) {
        Microi.Tips(`请填写${element == 'Tupian' ? '上传照片' : '检查评分'}`, false)
        isLoading.value = false
        hasMissingData = true; // 标记有缺失的数据
        return false
      }
    })
    if (hasMissingData) {
      return false; // 如果有缺失的数据，跳出外部循环
    }
  });
  if (hasMissingData) return hasMissingData = false
  const res = await Microi.FormEngine.UptFormDataBatch(combinedArray)
  if (res.Code == 1) {
    const res1 = await Microi.ApiEngine.Run('5Supdate_planSpeed', {
      Id: detail.value.Id,
      LaiyuanID: detail.value.LaiyuanID,
    })
    Microi.Tips('提交成功')
    uni.navigateBack()
  } else {
    Microi.Tips('提交失败', false)
  }
  isLoading.value = false
}
onLoad((options) => {
  Zhuangtai.value = options.Zhuangtai
})
onMounted(() => {
  detail.value = JSON.parse(uni.getStorageSync('checkPlanDetail'))
  getListData()
})
</script>
<style lang="scss" scoped>
@import './index.scss';

.list {
  padding-bottom: 5em;
}

.list-item {
  box-shadow: none;
  margin-bottom: 10px;
}

.Divider {
  height: 1px;
  background-color: #DDDDDD;
}

.content {
  padding: 10px 20px;

  &-title {
    font-size: 19px;
    font-weight: 400;
  }

  &-desc {
    margin-bottom: 20px;

    &-left {
      .drop {
        width: 12px;
        height: 12px;
        opacity: 1;
        background: #3579F4;
        border-radius: 50%;
      }

      .line {
        width: 1px;
        height: 100%;
        background-color: #DDDDDD;
        margin-top: 10px;
      }

      margin-right: 10px;
      margin-top: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    &-right {
      flex: 1;
      border-radius: 15px;
      background: #FFFFFF;
      box-shadow: 0px 20px 60px rgba(102, 127, 191, 0.25);

      &-item {
        padding: 20px;
      }

      &-item-img {
        width: 84px;
        height: 115px;
        flex-shrink: 0;
        margin-right: 10px;

        .swiper-box {
          height: 115px;
        }
      }

      .item-Img {
        width: 100%;
        height: 100%;
      }

      &-item-text {
        font-size: 15px;
        font-weight: 400;
        color: #444444;
        line-height: 25px;
      }

      &-item-title {
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0px;
        line-height: 25px;
        margin-bottom: 10px;
      }

      .radio-item {
        justify-content: space-around;
        font-size: 17px;
      }
    }
  }

  &-triangle {
    // transform: scale(0.7);
    background: #555555;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;

    &-up {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 8px solid white;
    }

    &-down {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 8px solid white;
    }
  }

  .item-TupianFK {
    width: 75px;
    height: 75px;
    border-radius: 20px;
    margin-right: 8px;
  }

  .text-tips {
    font-size: 17px;
    margin-left: 10px;
    font-weight: 400;
    color: #444444;
  }

  .item-radio {
    width: 26px;
    height: 26px;
    color: #444444;
    border: 1.5px solid #DDDDDD;
    font-size: 17px;
    line-height: 26px;
    text-align: center;
    border-radius: 50%;
  }

  .item-radio-active {
    background: #3579F4;
    color: white;
  }

  &-saoma {
    font-size: 17px;
    font-weight: 400;
    line-height: 34px;
    color: rgba(34, 34, 34, 1);
    display: flex;

  }
}

.progress-box {
  display: flex;
  width: 50%;
  align-items: center;
}

.progress-bar-container {
  height: 10px;
  width: 100%;
  border-radius: 35px;
  background: rgba(243, 249, 255, 1);
  border: 0.5px solid rgba(53, 121, 244, 0.4);
  margin-right: 10px;
}

.progress-bar {
  height: 10px;
  background-color: rgba(53, 121, 244, 1);
  border-radius: 35px;
  text-align: center;
  line-height: 10px;
  /* Same as height */
  color: white;
}

.progress-text {
  color: rgba(53, 121, 244, 1);
  font-size: 12px;
  font-weight: 400;
}

.sub-btn {
  position: fixed;
  bottom: 0rpx;
  left: 0;
  right: 0;
  background-color: white;
  padding: 20rpx;
  z-index: 3
}
</style>