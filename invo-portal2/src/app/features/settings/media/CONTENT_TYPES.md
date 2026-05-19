# 📋 Content Types Reference

## ✅ الأنواع الصحيحة للـ API:

```typescript
// في الـ components
filterTypes = [
  {
    text: 'Image',
    value: 'image',
    checked: false,
  },
  {
    text: 'Document',
    value: 'document',  // ← Not 'docs'!
    checked: false,
  },
  {
    text: 'Video',
    value: 'video',
    checked: false,
  },
  {
    text: 'Audio',
    value: 'audio',
    checked: false,
  },
  {
    text: '3D Model',
    value: 'model',  // ← للملفات ثلاثية الأبعاد
    checked: false,
  }
];
```

---

## 🔧 في media-manager.component.ts:

```typescript
type ViewTab = 'all' | 'images' | 'documents' | 'videos' | 'audio' | 'models';

private getContentTypeForTab(tab: ViewTab): string[] {
  switch (tab) {
    case 'images':
      return ['image'];
    case 'documents':
      return ['document'];  // ✅ Not 'docs'
    case 'videos':
      return ['video'];
    case 'audio':
      return ['audio'];
    case 'models':
      return ['model'];  // ✅ للملفات 3D
    case 'all':
    default:
      return [];
  }
}
```

---

## 📦 Request Examples:

### الصور:
```json
{
  "page": 1,
  "limit": 15,
  "contentType": ["image"]
}
```

### المستندات:
```json
{
  "page": 1,
  "limit": 15,
  "contentType": ["document"]  // ← Not 'docs'
}
```

### فيديوهات وصور معاً:
```json
{
  "page": 1,
  "limit": 15,
  "contentType": ["video", "image"]
}
```

### كل الأنواع:
```json
{
  "page": 1,
  "limit": 15,
  "contentType": []  // Empty = all types
}
```

---

## ⚠️ ملاحظات مهمة:

1. **استخدم `document` وليس `docs`**
2. **الأنواع المتاحة:**
   - `image` - الصور
   - `document` - المستندات
   - `video` - الفيديوهات
   - `audio` - الصوتيات
   - `model` - الملفات 3D

3. **Array فارغ = كل الأنواع**

---

**Status:** ✅ Updated and Fixed
