import { Info, Shield, Code, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminSettings() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Ayarlar</h1>
        <p className="mt-1 text-sm text-neutral-500">Sistem yapılandırması ve bilgi</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-neutral-500" />
              Sistem Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-neutral-600">
            <div className="flex justify-between">
              <span>Ürün Tarama Motoru</span>
              <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Koton entegre edildi
              </span>
            </div>
            <div className="flex justify-between">
              <span>Otomatik Tarama</span>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                Manuel tarama aktif
              </span>
            </div>
            <div className="flex justify-between">
              <span>Yönetim Paneli</span>
              <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Aktif
              </span>
            </div>
            <div className="flex justify-between">
              <span>Mobil Uygulama Arayüzü</span>
              <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Aktif
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-neutral-500" />
              Güvenlik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-neutral-600">
            <p>Row Level Security (RLS) tüm tablolarda etkin.</p>
            <p>Admin işlemleri yetki kontrolü ile korunmaktadır.</p>
            <p>Service Role Key istemci tarafına gönderilmez.</p>
            <p>URL doğrulaması site ekleme sırasında yapılır.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code className="h-4 w-4 text-neutral-500" />
              Tarama Mimarisi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-neutral-600">
            <p>Her e-ticaret sitesi için modüler adapter sistemi hazırdır.</p>
            <p>Standart ürün formatı: product_name, brand, category, image_url, current_price, original_price, product_url, external_product_id.</p>
            <p>Koton adapter (Akinon platform) Supabase Edge Function olarak dağıtıldı.</p>
            <p>Ürün verisi HTML içine gömülü JSON-LD ve yapılandırılmış veriden ayrıştırılır.</p>
            <p>Yeni adapter'lar (LCWaikiki, DeFacto vb.) bir sonraki aşamada eklenecektir.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-neutral-500" />
              Bildirim Tercihleri
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-400">
            <p>Bildirim ayarları bir sonraki aşamada eklenecektir.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
