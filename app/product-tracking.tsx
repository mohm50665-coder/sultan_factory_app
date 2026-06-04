import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import {
  productionService,
  manufacturingService,
  warehouseService,
} from '@/lib/services/api.service';

interface ProductStage {
  stage: string;
  quantity: number;
  date: string;
  worker: string;
}

interface ProductTracking {
  productName: string;
  stages: ProductStage[];
}

const STAGES = [
  { id: 'production', name: 'الإنتاج', icon: '🏭' },
  { id: 'rosso', name: 'الروسو', icon: '🧵' },
  { id: 'heart', name: 'القلب', icon: '❤️' },
  { id: 'ironing', name: 'الكاوية', icon: '🔥' },
  { id: 'inspection', name: 'الفحص', icon: '🔍' },
  { id: 'packaging', name: 'التغليف', icon: '📦' },
  { id: 'antislip', name: 'مانع الانزلاق', icon: '👟' },
  { id: 'storage', name: 'التخزين', icon: '🏢' },
];

export default function ProductTrackingScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [searchProduct, setSearchProduct] = useState('');
  const [tracking, setTracking] = useState<ProductTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchProduct.trim()) {
      setError('الرجاء إدخال اسم المنتج');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // جلب بيانات الإنتاج
      const productionData = await productionService.getAll();
      const productionRecords = (productionData || []).filter(
        (p: any) => p.productName?.toLowerCase().includes(searchProduct.toLowerCase())
      );

      // جلب بيانات مراحل التسليم
      const manufacturingData = await manufacturingService.getAll();
      const manufacturingRecords = (manufacturingData || []).filter(
        (m: any) => m.productName?.toLowerCase().includes(searchProduct.toLowerCase())
      );

      // جلب بيانات المستودع (الداخل)
      const warehouseIncoming = await warehouseService.getIncoming();
      const warehouseRecords = (warehouseIncoming || []).filter(
        (w: any) => w.productName?.toLowerCase().includes(searchProduct.toLowerCase())
      );

      // بناء مسار المنتج
      const stages: ProductStage[] = [];

      // الإنتاج
      productionRecords.forEach((p: any) => {
        stages.push({
          stage: 'production',
          quantity: p.quantityDozen || 0,
          date: p.date || new Date().toISOString().split('T')[0],
          worker: p.workerName || 'غير محدد',
        });
      });

      // مراحل التسليم
      manufacturingRecords.forEach((m: any) => {
        const stageMap: { [key: string]: string } = {
          'rosso': 'rosso',
          'heart': 'heart',
          'ironing': 'ironing',
          'inspection': 'inspection',
          'packaging': 'packaging',
          'antislip': 'antislip',
        };

        if (m.stageName && stageMap[m.stageName]) {
          stages.push({
            stage: stageMap[m.stageName],
            quantity: m.quantity || 0,
            date: m.date || new Date().toISOString().split('T')[0],
            worker: m.workerName || 'غير محدد',
          });
        }
      });

      // التخزين
      warehouseRecords.forEach((w: any) => {
        stages.push({
          stage: 'storage',
          quantity: w.quantityDozen || 0,
          date: w.date || new Date().toISOString().split('T')[0],
          worker: w.workerName || 'غير محدد',
        });
      });

      if (stages.length === 0) {
        setError('لم يتم العثور على بيانات لهذا المنتج');
        setTracking(null);
      } else {
        setTracking({
          productName: searchProduct,
          stages: stages.sort((a, b) => {
            const stageOrder = ['production', 'rosso', 'heart', 'ironing', 'inspection', 'packaging', 'antislip', 'storage'];
            return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
          }),
        });
      }
    } catch (err) {
      setError('حدث خطأ في جلب البيانات');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStageInfo = (stageId: string) => {
    return STAGES.find(s => s.id === stageId);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* العنوان */}
          <View className="mb-4">
            <Text className="text-3xl font-bold text-foreground mb-2">تتبع المنتج</Text>
            <Text className="text-sm text-muted">تتبع مسار المنتج عبر جميع مراحل الإنتاج</Text>
          </View>

          {/* حقل البحث */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">اسم المنتج</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 border border-border rounded-lg p-3 text-foreground bg-surface"
                placeholder="ابحث عن المنتج..."
                placeholderTextColor={colors.muted}
                value={searchProduct}
                onChangeText={setSearchProduct}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                className="bg-primary rounded-lg px-4 justify-center"
                onPress={handleSearch}
                disabled={loading}
              >
                <Text className="text-background font-semibold">
                  {loading ? '...' : 'بحث'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* رسالة الخطأ */}
          {error ? (
            <View className="bg-error/10 border border-error rounded-lg p-3">
              <Text className="text-error text-sm">{error}</Text>
            </View>
          ) : null}

          {/* التحميل */}
          {loading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-muted mt-2">جاري البحث...</Text>
            </View>
          ) : null}

          {/* مسار المنتج */}
          {tracking && !loading ? (
            <View className="gap-4">
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-2">
                  المنتج: {tracking.productName}
                </Text>
                <Text className="text-sm text-muted">
                  عدد المراحل: {tracking.stages.length}
                </Text>
              </View>

              {/* خط المسار */}
              <View className="gap-3">
                {tracking.stages.map((stage, index) => {
                  const stageInfo = getStageInfo(stage.stage);
                  return (
                    <View key={`${stage.stage}-${index}`}>
                      <View className="flex-row gap-3">
                        {/* الأيقونة والخط */}
                        <View className="items-center">
                          <View
                            className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center"
                            style={{ borderColor: colors.primary, borderWidth: 2 }}
                          >
                            <Text className="text-xl">{stageInfo?.icon}</Text>
                          </View>
                          {index < tracking.stages.length - 1 && (
                            <View
                              className="w-1 flex-1 my-1"
                              style={{ backgroundColor: colors.primary, minHeight: 30 }}
                            />
                          )}
                        </View>

                        {/* البيانات */}
                        <View className="flex-1 bg-surface rounded-lg p-3 border border-border">
                          <Text className="text-base font-bold text-foreground">
                            {stageInfo?.name}
                          </Text>
                          <View className="gap-1 mt-2">
                            <View className="flex-row justify-between">
                              <Text className="text-sm text-muted">الكمية:</Text>
                              <Text className="text-sm font-semibold text-foreground">
                                {stage.quantity || 0} درزن
                              </Text>
                            </View>
                            <View className="flex-row justify-between">
                              <Text className="text-sm text-muted">التاريخ:</Text>
                              <Text className="text-sm font-semibold text-foreground">
                                {stage.date}
                              </Text>
                            </View>
                            <View className="flex-row justify-between">
                              <Text className="text-sm text-muted">الموظف:</Text>
                              <Text className="text-sm font-semibold text-foreground">
                                {stage.worker}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* ملخص */}
              <View className="bg-success/10 border border-success rounded-lg p-4">
                <Text className="text-success font-bold mb-2">✓ المنتج وصل إلى المستودع</Text>
                <Text className="text-sm text-foreground">
                  تم تتبع المنتج عبر {tracking.stages.length} مراحل بنجاح
                </Text>
              </View>
            </View>
          ) : null}

          {/* رسالة عدم وجود بيانات */}
          {!tracking && !loading && !error && searchProduct ? (
            <View className="items-center justify-center py-8">
              <Text className="text-muted text-center">ابدأ البحث عن منتج لتتبع مساره</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
