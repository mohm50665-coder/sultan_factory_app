import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import {
  productionService,
  manufacturingService,
  adminService,
} from '@/lib/services/api.service';

interface EmployeePerformance {
  name: string;
  totalProduction: number;
  totalProcessed: number;
  efficiency: number;
  stage?: string;
}

interface MachinePerformance {
  machine: string;
  totalProduction: number;
  averageEfficiency: number;
  shiftCount: number;
}

interface ShiftPerformance {
  shift: number;
  totalProduction: number;
  averageEfficiency: number;
  employeeCount?: any;
}

export default function PerformanceComparisonScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'employees' | 'machines' | 'shifts'>('employees');
  const [employees, setEmployees] = useState<EmployeePerformance[]>([]);
  const [machines, setMachines] = useState<MachinePerformance[]>([]);
  const [shifts, setShifts] = useState<ShiftPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'employees') {
        await loadEmployeePerformance();
      } else if (activeTab === 'machines') {
        await loadMachinePerformance();
      } else {
        await loadShiftPerformance();
      }
    } catch (err) {
      setError('حدث خطأ في جلب البيانات');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeePerformance = async () => {
    try {
      const productionData = await productionService.getAll();
      const manufacturingData = await manufacturingService.getAll();

      const employeeMap: { [key: string]: EmployeePerformance } = {};

      // معالجة بيانات الإنتاج
      (productionData || []).forEach((p: any) => {
        if (!employeeMap[p.workerName]) {
          employeeMap[p.workerName] = {
            name: p.workerName,
            totalProduction: 0,
            totalProcessed: 0,
            efficiency: 0,
          };
        }
        employeeMap[p.workerName].totalProduction += p.quantityDozen || 0;
      });

      // معالجة بيانات مراحل التسليم
      (manufacturingData || []).forEach((m: any) => {
        if (!employeeMap[m.workerName]) {
          employeeMap[m.workerName] = {
            name: m.workerName,
            totalProduction: 0,
            totalProcessed: 0,
            efficiency: 0,
            stage: m.stageName,
          };
        }
        employeeMap[m.workerName].totalProcessed += m.quantity || 0;
      });

      // حساب الكفاءة
      const employeeList = Object.values(employeeMap).map(emp => ({
        ...emp,
        efficiency: emp.totalProduction > 0 ? Math.round((emp.totalProcessed / emp.totalProduction) * 100) : 0,
      }));

      // ترتيب حسب الكفاءة
      employeeList.sort((a, b) => b.efficiency - a.efficiency);
      setEmployees(employeeList);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const loadMachinePerformance = async () => {
    try {
      const productionData = await productionService.getAll();

      const machineMap: { [key: string]: MachinePerformance } = {};

      (productionData || []).forEach((p: any) => {
        if (!machineMap[p.machineNumber]) {
          machineMap[p.machineNumber] = {
            machine: p.machineNumber,
            totalProduction: 0,
            averageEfficiency: 0,
            shiftCount: 0,
          };
        }
        machineMap[p.machineNumber].totalProduction += p.quantityDozen || 0;
        machineMap[p.machineNumber].shiftCount += 1;
      });

      // حساب متوسط الكفاءة
      const machineList = Object.values(machineMap).map(machine => ({
        ...machine,
        averageEfficiency: machine.shiftCount > 0 ? Math.round(machine.totalProduction / machine.shiftCount) : 0,
      }));

      // ترتيب حسب الإنتاج
      machineList.sort((a, b) => b.totalProduction - a.totalProduction);
      setMachines(machineList);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const loadShiftPerformance = async () => {
    try {
      const productionData = await productionService.getAll();

      const shiftMap: { [key: number]: { shift: number; totalProduction: number; employees: Set<string> } } = {};

      (productionData || []).forEach((p: any) => {
        const shift = p.shiftNumber || 1;
        if (!shiftMap[shift]) {
          shiftMap[shift] = {
            shift,
            totalProduction: 0,
            employees: new Set<string>(),
          };
        }
        shiftMap[shift].totalProduction += p.quantityDozen || 0;
        if (p.workerName) {
          shiftMap[shift].employees.add(p.workerName);
        }
      });

      // تحويل إلى قائمة
      const shiftList = Object.values(shiftMap).map(shift => ({
        shift: shift.shift,
        totalProduction: shift.totalProduction,
        averageEfficiency: shift.totalProduction > 0 ? Math.round(shift.totalProduction / 3) : 0,
        employeeCount: shift.employees.size,
      }));

      // ترتيب حسب الإنتاج
      shiftList.sort((a, b) => b.totalProduction - a.totalProduction);
      setShifts(shiftList);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const renderEmployeeCard = (emp: EmployeePerformance, index: number) => (
    <View key={index} className="bg-surface rounded-lg p-4 border border-border mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground">{emp.name}</Text>
          {emp.stage && <Text className="text-xs text-muted mt-1">{emp.stage}</Text>}
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: emp.efficiency >= 80 ? colors.success : emp.efficiency >= 60 ? colors.warning : colors.error }}
        >
          <Text className="text-white font-bold text-sm">{emp.efficiency}%</Text>
        </View>
      </View>
      <View className="gap-1">
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">الإنتاج:</Text>
          <Text className="text-sm font-semibold text-foreground">{emp.totalProduction} درزن</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">المعالجة:</Text>
          <Text className="text-sm font-semibold text-foreground">{emp.totalProcessed} درزن</Text>
        </View>
      </View>
    </View>
  );

  const renderMachineCard = (machine: MachinePerformance, index: number) => (
    <View key={index} className="bg-surface rounded-lg p-4 border border-border mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-base font-bold text-foreground">{machine.machine}</Text>
        <View className="px-3 py-1 rounded-full bg-primary/20">
          <Text className="text-primary font-bold text-sm">{machine.averageEfficiency} درزن/وردية</Text>
        </View>
      </View>
      <View className="gap-1">
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">الإنتاج الكلي:</Text>
          <Text className="text-sm font-semibold text-foreground">{machine.totalProduction} درزن</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">عدد الورديات:</Text>
          <Text className="text-sm font-semibold text-foreground">{machine.shiftCount}</Text>
        </View>
      </View>
    </View>
  );

  const renderShiftCard = (shift: ShiftPerformance, index: number) => (
    <View key={index} className="bg-surface rounded-lg p-4 border border-border mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-base font-bold text-foreground">الوردية {shift.shift}</Text>
        <View className="px-3 py-1 rounded-full bg-primary/20">
          <Text className="text-primary font-bold text-sm">{shift.totalProduction} درزن</Text>
        </View>
      </View>
      <View className="gap-1">
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">متوسط الكفاءة:</Text>
          <Text className="text-sm font-semibold text-foreground">{shift.averageEfficiency} درزن</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-muted">عدد الموظفين:</Text>
          <Text className="text-sm font-semibold text-foreground">{shift.employeeCount}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-4">
          {/* العنوان */}
          <View className="mb-4">
            <Text className="text-3xl font-bold text-foreground mb-2">مقارنة الأداء</Text>
            <Text className="text-sm text-muted">تقرير مقارنة أداء الموظفين والمكائن والورديات</Text>
          </View>

          {/* التبويبات */}
          <View className="flex-row gap-2 bg-surface rounded-lg p-1 border border-border">
            {(['employees', 'machines', 'shifts'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 py-2 rounded-lg ${
                  activeTab === tab ? 'bg-primary' : 'bg-transparent'
                }`}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  className={`text-center font-semibold text-sm ${
                    activeTab === tab ? 'text-background' : 'text-foreground'
                  }`}
                >
                  {tab === 'employees' ? 'الموظفون' : tab === 'machines' ? 'المكائن' : 'الورديات'}
                </Text>
              </TouchableOpacity>
            ))}
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
              <Text className="text-muted mt-2">جاري تحميل البيانات...</Text>
            </View>
          ) : null}

          {/* محتوى التبويبات */}
          {!loading && activeTab === 'employees' && (
            <View>
              {employees.length === 0 ? (
                <View className="items-center justify-center py-8">
                  <Text className="text-muted">لا توجد بيانات للموظفين</Text>
                </View>
              ) : (
                <View>
                  {employees.map((emp, idx) => renderEmployeeCard(emp, idx))}
                </View>
              )}
            </View>
          )}

          {!loading && activeTab === 'machines' && (
            <View>
              {machines.length === 0 ? (
                <View className="items-center justify-center py-8">
                  <Text className="text-muted">لا توجد بيانات للمكائن</Text>
                </View>
              ) : (
                <View>
                  {machines.map((machine, idx) => renderMachineCard(machine, idx))}
                </View>
              )}
            </View>
          )}

          {!loading && activeTab === 'shifts' && (
            <View>
              {shifts.length === 0 ? (
                <View className="items-center justify-center py-8">
                  <Text className="text-muted">لا توجد بيانات للورديات</Text>
                </View>
              ) : (
                <View>
                  {shifts.map((shift, idx) => renderShiftCard(shift, idx))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
