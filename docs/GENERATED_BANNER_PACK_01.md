# Дополнительные генеративные баннеры Spirit Freedom

Первая партия из 7 широкоформатных изображений создана для нового визуального оформления.

| Item ID | Название | Путь в приложении |
| --- | --- | --- |
| `banner_ocean` | Бездна океана | `app/public/banners/banner_ocean.webp` |
| `banner_forest` | Изумрудная чаща | `app/public/banners/banner_forest.webp` |
| `banner_sunset` | Последний закат | `app/public/banners/banner_sunset.webp` |
| `banner_neon` | Неоновый импульс | `app/public/banners/banner_neon.webp` |
| `banner_ice` | Кристальный шторм | `app/public/banners/banner_ice.webp` |
| `banner_galaxy` | Рождение галактики | `app/public/banners/banner_galaxy.webp` |
| `banner_shadow` | Тихая тень | `app/public/banners/banner_shadow.webp` |

**Пакет графики не включён в этот коммит.** Он отдельно подготовлен для передачи как архив `spirit_banner_pack_01.zip`. Перед публикацией разместить файлы по указанным путям и проверить, что каждый URL возвращает WebP. Пока файлов нет, приложение автоматически использует сохранённые **оригинальные** SVG/JPEG-баннеры Discord-бота, уже присутствующие в `app/public/profile-banners`.

Для следующих изображений `banner_gold`, `banner_pumpkin`, `banner_graveyard` генерации этой партии ещё не готовы. Текущую живую экипировку и базу экономики не менять.

Широкие WebP: 1440x480, идентификаторы совпадают с `src/economy.js`. Не путать изображение карточки и состояние собственности: клиент читает `inventory`/`equipped` только из защищённого API профиля.
