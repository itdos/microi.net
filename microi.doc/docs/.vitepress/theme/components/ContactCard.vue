<template>
  <div class="contact-container">
    <div class="contact-grid">
      <div v-for="person in contacts" :key="person.name" class="contact-card">
        <div class="card-inner">
          <div class="qr-code">
            <img :src="person.qrCode" :alt="person.name" data-fancybox="gallery" />
          </div>
          <div class="card-content">
            <div class="name-section">
              <div class="avatar">
                <img :src="person.avatar || person.qrCode" :alt="person.name" />
              </div>
              <div class="name-info">
                <h3 class="person-name">{{ person.name }}</h3>
                <div class="person-role">{{ person.role }}</div>
              </div>
            </div>
            <div class="contact-info">
              <div v-if="person.phone" class="info-item">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{{ person.phone }}</span>
              </div>
              <div v-if="person.email" class="info-item">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{{ person.email }}</span>
              </div>
              <div v-if="person.wechat" class="info-item">
                <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1 .178-.555c1.529-1.185 2.481-2.806 2.481-4.634 0-3.548-3.514-6.233-7.041-6.106zm-2.428 3.701c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.856 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
                <span>{{ person.wechat }}</span>
              </div>
              <div v-if="person.link" class="info-item info-item-link">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <a :href="person.link" target="_blank" rel="noopener noreferrer">{{ person.link }}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Contact {
  name: string;
  role: string;
  qrCode: string;
  avatar?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  link?: string;
}

defineProps<{
  contacts: Contact[];
}>();
</script>

<style scoped>
.contact-container {
  padding: 2rem 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
}

.contact-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.contact-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: var(--vp-c-brand);
}

.card-inner {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.qr-code {
  margin-bottom: 1.5rem;
}

.qr-code img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  cursor: pointer;
}

.qr-code img:hover {
  transform: scale(1.05);
}

.card-content {
  width: 100%;
}

.name-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.avatar {
  flex-shrink: 0;
}

.avatar img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--vp-c-brand);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.name-info {
  flex: 1;
  text-align: left;
}

.person-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: var(--vp-c-text-1);
}

.person-role {
  font-size: 0.9rem;
  color: var(--vp-c-brand);
  margin: 0;
  font-weight: 500;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
  width: 100%;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  width: 100%;
  padding: 0.5rem;
  background: var(--vp-c-bg);
  border-radius: 6px;
  transition: background 0.2s ease;
}

.info-item:hover {
  background: var(--vp-c-bg-alt);
}

.info-item .icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--vp-c-brand);
}

.info-item span {
  flex: 1;
  text-align: left;
  word-break: break-all;
}

.info-item-link a {
  flex: 1;
  text-align: left;
  word-break: break-all;
  color: var(--vp-c-brand);
  text-decoration: none;
  transition: color 0.2s ease;
}

.info-item-link a:hover {
  color: var(--vp-c-brand-light);
  text-decoration: underline;
}

@media (max-width: 768px) {
  .contact-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .qr-code img {
    width: 180px;
    height: 180px;
  }
}
</style>
