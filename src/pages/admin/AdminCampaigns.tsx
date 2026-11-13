import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw, AlertCircle, Plus, Pencil, Trash2, Eye, Tag, Truck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Campaign, Brand, Source } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatPrice, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Yüzde (%)' },
  { value: 'fixed_amount', label: 'Sabit Tutar (TL)' },
  { value: 'free_shipping', label: 'Ücretsiz Kargo' },
  { value: 'other', label: 'Diğer' },
];

export function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [freeShipping, setFreeShipping] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [terms, setTerms] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [brandId, setBrandId] = useState('none');
  const [sourceId, setSourceId] = useState('none');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const [campRes, brandRes, sourceRes] = await Promise.all([
      supabase.from('campaigns').select('*, brand:brands(*), source:sources(*)').order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('name'),
      supabase.from('sources').select('*').order('name'),
    ]);

    if (campRes.error) {
      setLoadError('Kampanyalar yüklenirken bir hata oluştu.');
      setLoading(false);
      return;
    }

    setCampaigns((campRes.data as Campaign[]) ?? []);
    setBrands((brandRes.data as Brand[]) ?? []);
    setSources((sourceRes.data as Source[]) ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingCampaign(null);
    setTitle('');
    setDescription('');
    setCouponCode('');
    setDiscountType('percentage');
    setDiscountValue('');
    setMinOrder('');
    setMaxDiscount('');
    setFreeShipping(false);
    setStartDate('');
    setEndDate('');
    setTerms('');
    setIsActive(true);
    setBrandId('none');
    setSourceId('none');
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(campaign: Campaign) {
    setEditingCampaign(campaign);
    setTitle(campaign.title);
    setDescription(campaign.description ?? '');
    setCouponCode(campaign.coupon_code ?? '');
    setDiscountType(campaign.discount_type);
    setDiscountValue(campaign.discount_value?.toString() ?? '');
    setMinOrder(campaign.minimum_order_amount?.toString() ?? '');
    setMaxDiscount(campaign.maximum_discount_amount?.toString() ?? '');
    setFreeShipping(campaign.free_shipping);
    setStartDate(campaign.start_date ?? '');
    setEndDate(campaign.end_date ?? '');
    setTerms(campaign.terms ?? '');
    setIsActive(campaign.is_active);
    setBrandId(campaign.brand_id ?? 'none');
    setSourceId(campaign.source_id ?? 'none');
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Kampanya başlığı zorunludur.');
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      coupon_code: couponCode.trim() || null,
      discount_type: discountType,
      discount_value: discountValue ? Number(discountValue) : null,
      minimum_order_amount: minOrder ? Number(minOrder) : null,
      maximum_discount_amount: maxDiscount ? Number(maxDiscount) : null,
      free_shipping: freeShipping,
      start_date: startDate || null,
      end_date: endDate || null,
      terms: terms.trim() || null,
      is_active: isActive,
      brand_id: brandId !== 'none' ? brandId : null,
      source_id: sourceId !== 'none' ? sourceId : null,
      updated_at: new Date().toISOString(),
    };

    if (editingCampaign) {
      const { error } = await supabase.from('campaigns').update(payload).eq('id', editingCampaign.id);
      if (error) {
        setFormError('Güncelleme sırasında bir hata oluştu: ' + error.message);
        setSaving(false);
        return;
      }
      toast.success('Kampanya güncellendi', { description: `"${title}" başarıyla güncellendi.` });
    } else {
      const { error } = await supabase.from('campaigns').insert(payload);
      if (error) {
        setFormError('Ekleme sırasında bir hata oluştu: ' + error.message);
        setSaving(false);
        return;
      }
      toast.success('Kampanya eklendi', { description: `"${title}" başarıyla eklendi.` });
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  }

  async function handleToggle(campaign: Campaign) {
    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: !campaign.is_active, updated_at: new Date().toISOString() })
      .eq('id', campaign.id);
    if (error) {
      toast.error('Durum güncellenemedi', { description: 'Kampanya durumu değiştirilemedi.' });
      return;
    }
    toast.success(campaign.is_active ? 'Kampanya pasife alındı' : 'Kampanya aktifleştirildi');
    load();
  }

  async function handleDeleteRequest(campaign: Campaign) {
    confirm(
      {
        title: 'Kampanyayı Sil',
        description: `"${campaign.title}" kampanyasını silmek istediğinizden emin misiniz?`,
        confirmText: 'Sil',
        destructive: true,
      },
      async () => {
        const { error } = await supabase.from('campaigns').delete().eq('id', campaign.id);
        if (error) {
          toast.error('Silme işlemi başarısız', { description: 'Kampanya silinemedi.' });
          return;
        }
        toast.success('Kampanya silindi', { description: `"${campaign.title}" silindi.` });
        load();
      }
    );
  }

  if (loading) return <LoadingSpinner message="Kampanyalar yükleniyor..." />;

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Kampanyalar</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Kampanyalar</h1>
          <p className="mt-1 text-sm text-neutral-500">Kupon kodlu ve kampanya bazlı indirimleri yönetin</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Kampanya Ekle
        </Button>
      </div>

      <Card className="overflow-hidden">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-7 w-7" />}
            title="Henüz kampanya yok"
            description="Kampanyalar, tarama sırasında otomatik algılanır veya manuel olarak eklenebilir."
            action={
              <Button onClick={openAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Kampanya Ekle
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Kupon Kodu</TableHead>
                  <TableHead>İndirim</TableHead>
                  <TableHead>Min. Sepet</TableHead>
                  <TableHead>Kargo</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son Tarama</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="max-w-[200px] font-medium">
                      <div className="truncate" title={campaign.title}>{campaign.title}</div>
                    </TableCell>
                    <TableCell>
                      {campaign.coupon_code ? (
                        <Badge variant="secondary" className="font-mono">{campaign.coupon_code}</Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.discount_type === 'percentage' && campaign.discount_value != null
                        ? `%${campaign.discount_value}`
                        : campaign.discount_type === 'fixed_amount' && campaign.discount_value != null
                        ? formatPrice(campaign.discount_value)
                        : campaign.discount_type === 'free_shipping'
                        ? 'Ücretsiz Kargo'
                        : campaign.discount_type === 'other'
                        ? '-'
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {campaign.minimum_order_amount != null
                        ? formatPrice(campaign.minimum_order_amount)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {campaign.free_shipping ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <Truck className="mr-1 h-3 w-3" /> Ücretsiz
                        </Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.brand ? (
                        <span className="text-sm">{campaign.brand.name}</span>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={campaign.is_active}
                        onCheckedChange={() => handleToggle(campaign)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {formatDateTime(campaign.scraped_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewCampaign(campaign)} title="Detay">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(campaign)} title="Düzenle">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(campaign)} title="Sil">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewCampaign} onOpenChange={(open) => !open && setViewCampaign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-neutral-400" />
              Kampanya Detayı
            </DialogTitle>
          </DialogHeader>
          {viewCampaign && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-neutral-500">Başlık</Label>
                <p className="text-sm font-medium text-neutral-900">{viewCampaign.title}</p>
              </div>
              {viewCampaign.description && (
                <div>
                  <Label className="text-xs text-neutral-500">Açıklama</Label>
                  <p className="text-sm text-neutral-700">{viewCampaign.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {viewCampaign.coupon_code && (
                  <div>
                    <Label className="text-xs text-neutral-500">Kupon Kodu</Label>
                    <p className="font-mono text-sm font-medium">{viewCampaign.coupon_code}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-neutral-500">İndirim Türü</Label>
                  <p className="text-sm">
                    {DISCOUNT_TYPES.find((t) => t.value === viewCampaign.discount_type)?.label}
                    {viewCampaign.discount_value != null && `: ${viewCampaign.discount_value}`}
                  </p>
                </div>
                {viewCampaign.minimum_order_amount != null && (
                  <div>
                    <Label className="text-xs text-neutral-500">Min. Sepet Tutarı</Label>
                    <p className="text-sm">{formatPrice(viewCampaign.minimum_order_amount)}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-neutral-500">Ücretsiz Kargo</Label>
                  <p className="text-sm">{viewCampaign.free_shipping ? 'Evet' : 'Hayır'}</p>
                </div>
                {viewCampaign.start_date && (
                  <div>
                    <Label className="text-xs text-neutral-500">Başlangıç</Label>
                    <p className="text-sm">{viewCampaign.start_date}</p>
                  </div>
                )}
                {viewCampaign.end_date && (
                  <div>
                    <Label className="text-xs text-neutral-500">Bitiş</Label>
                    <p className="text-sm">{viewCampaign.end_date}</p>
                  </div>
                )}
              </div>
              {viewCampaign.terms && (
                <div>
                  <Label className="text-xs text-neutral-500">Koşullar</Label>
                  <p className="text-sm text-neutral-600">{viewCampaign.terms}</p>
                </div>
              )}
              {viewCampaign.source_url && (
                <div>
                  <Label className="text-xs text-neutral-500">Kaynak URL</Label>
                  <a
                    href={viewCampaign.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {viewCampaign.source_url}
                  </a>
                </div>
              )}
              <div className="text-xs text-neutral-400">
                Son tarama: {formatDateTime(viewCampaign.scraped_at)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</DialogTitle>
            <DialogDescription>Kampanya koşullarını ve detaylarını yapılandırın.</DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="KTN30 ile %30 indirim" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="2000 TL üzerine KTN30 kodu ile %30 indirim" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coupon">Kupon Kodu</Label>
                <Input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="KTN30" />
              </div>
              <div className="space-y-2">
                <Label>İndirim Türü</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountValue">İndirim Değeri</Label>
                <Input id="discountValue" type="number" step="any" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minOrder">Min. Sepet Tutarı (TL)</Label>
                <Input id="minOrder" type="number" step="any" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="2000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxDiscount">Maks. İndirim Tutarı (TL)</Label>
                <Input id="maxDiscount" type="number" step="any" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">Bitiş Tarihi</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Koşullar</Label>
                <Input id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Sepette uygulanır" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marka</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kaynak</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok</SelectItem>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
              <Label className="cursor-pointer" onClick={() => setFreeShipping(!freeShipping)}>Ücretsiz Kargo</Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="cursor-pointer" onClick={() => setIsActive(!isActive)}>Aktif</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Kaydediliyor...' : editingCampaign ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
