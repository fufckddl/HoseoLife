import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { buildingService, Building, BuildingCreate, BuildingUpdate } from '../../services/buildingService';
import { userService } from '../../services/userService';
import { Colors } from '../../../constants/Colors';


interface BuildingFormData {
  id: string;
  name: string;
  campus: 'asan' | 'cheonan';
  latitude: string;
  longitude: string;
  radius: string;
  building_type: 'rectangle' | 'polygon';
  coordinates: Array<{ latitude: string; longitude: string }>;
  description: string;
}

export default function BuildingManagement() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState<BuildingFormData>({
    id: '',
    name: '',
    campus: 'asan',
    latitude: '',
    longitude: '',
    radius: '',
    building_type: 'rectangle',
    coordinates: [{ latitude: '', longitude: '' }],
    description: '',
  });

  useEffect(() => {
    if (user?.is_admin) {
      loadBuildings();
    }
  }, [user]);

  const loadBuildings = async () => {
    try {
      setLoading(true);
      const data = await buildingService.getAllBuildings();
      setBuildings(data);
    } catch (error) {
      console.error('건물 데이터 로드 실패:', error);
      Alert.alert('오류', '건물 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBuildings();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      campus: 'asan',
      latitude: '',
      longitude: '',
      radius: '',
      building_type: 'rectangle',
      coordinates: [{ latitude: '', longitude: '' }],
      description: '',
    });
    setEditingBuilding(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (building: Building) => {
    setEditingBuilding(building);
    setFormData({
      id: building.id,
      name: building.name,
      campus: building.campus,
      latitude: building.latitude.toString(),
      longitude: building.longitude.toString(),
      radius: building.radius.toString(),
      building_type: building.building_type,
      coordinates: building.coordinates.map(coord => ({
        latitude: coord.latitude.toString(),
        longitude: coord.longitude.toString(),
      })),
      description: building.description || '',
    });
    setModalVisible(true);
  };

  const addCoordinate = () => {
    setFormData(prev => ({
      ...prev,
      coordinates: [...prev.coordinates, { latitude: '', longitude: '' }],
    }));
  };

  const removeCoordinate = (index: number) => {
    if (formData.coordinates.length > 1) {
      setFormData(prev => ({
        ...prev,
        coordinates: prev.coordinates.filter((_, i) => i !== index),
      }));
    }
  };

  const updateCoordinate = (index: number, field: 'latitude' | 'longitude', value: string) => {
    setFormData(prev => ({
      ...prev,
      coordinates: prev.coordinates.map((coord, i) =>
        i === index ? { ...coord, [field]: value } : coord
      ),
    }));
  };

  const handleSubmit = async () => {
    try {
      // 입력 검증
      if (!formData.id || !formData.name || !formData.latitude || !formData.longitude || !formData.radius) {
        Alert.alert('오류', '필수 필드를 모두 입력해주세요.');
        return;
      }

      if (formData.coordinates.some(coord => !coord.latitude || !coord.longitude)) {
        Alert.alert('오류', '모든 좌표를 입력해주세요.');
        return;
      }

      const buildingData = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius: parseInt(formData.radius),
        coordinates: formData.coordinates.map(coord => ({
          latitude: parseFloat(coord.latitude),
          longitude: parseFloat(coord.longitude),
        })),
      };

      const token = await userService.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      if (editingBuilding) {
        // 수정
        const updatedBuilding = await buildingService.updateBuilding(
          editingBuilding.id,
          buildingData,
          token
        );
        setBuildings(prev => prev.map(b => b.id === updatedBuilding.id ? updatedBuilding : b));
        Alert.alert('성공', '건물 정보가 수정되었습니다.');
      } else {
        // 추가
        const newBuilding = await buildingService.createBuilding(
          buildingData as BuildingCreate,
          token
        );
        setBuildings(prev => [...prev, newBuilding]);
        Alert.alert('성공', '새 건물이 추가되었습니다.');
      }

      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('건물 저장 실패:', error);
      Alert.alert('오류', '건물 정보 저장에 실패했습니다.');
    }
  };

  const handleDelete = async (building: Building) => {
    Alert.alert(
      '건물 삭제',
      `"${building.name}" 건물을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await userService.getToken();
              if (!token) {
                Alert.alert('오류', '로그인이 필요합니다.');
                return;
              }
              
              await buildingService.deleteBuilding(building.id, token);
              setBuildings(prev => prev.filter(b => b.id !== building.id));
              Alert.alert('성공', '건물이 삭제되었습니다.');
            } catch (error) {
              console.error('건물 삭제 실패:', error);
              Alert.alert('오류', '건물 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  if (!user?.is_admin) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>관리자 권한이 필요합니다.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>건물 관리</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ 건물 추가</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {buildings.map((building) => (
          <View key={building.id} style={styles.buildingCard}>
            <View style={styles.buildingHeader}>
              <Text style={styles.buildingName}>{building.name}</Text>
              <View style={styles.buildingActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(building)}
                >
                  <Text style={styles.editButtonText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(building)}
                >
                  <Text style={styles.deleteButtonText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <Text style={styles.buildingInfo}>
              캠퍼스: {building.campus === 'asan' ? '아산' : '천안'}
            </Text>
            <Text style={styles.buildingInfo}>
              위치: {building.latitude}, {building.longitude}
            </Text>
            <Text style={styles.buildingInfo}>
              반지름: {building.radius}m
            </Text>
            <Text style={styles.buildingInfo}>
              형태: {building.building_type === 'rectangle' ? '사각형' : '다각형'}
            </Text>
            <Text style={styles.buildingInfo}>
              좌표 수: {building.coordinates.length}개
            </Text>
            {building.description && (
              <Text style={styles.buildingInfo}>설명: {building.description}</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* 건물 추가/수정 모달 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingBuilding ? '건물 수정' : '건물 추가'}
            </Text>
            
            <ScrollView style={styles.formScroll}>
              <TextInput
                style={styles.input}
                placeholder="건물 ID"
                value={formData.id}
                onChangeText={(text) => setFormData(prev => ({ ...prev, id: text }))}
                editable={!editingBuilding}
              />
              
              <TextInput
                style={styles.input}
                placeholder="건물명"
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              />
              
              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.campusButton,
                    formData.campus === 'asan' && styles.campusButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, campus: 'asan' }))}
                >
                  <Text style={[
                    styles.campusButtonText,
                    formData.campus === 'asan' && styles.campusButtonTextActive
                  ]}>아산캠퍼스</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.campusButton,
                    formData.campus === 'cheonan' && styles.campusButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, campus: 'cheonan' }))}
                >
                  <Text style={[
                    styles.campusButtonText,
                    formData.campus === 'cheonan' && styles.campusButtonTextActive
                  ]}>천안캠퍼스</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="위도"
                  value={formData.latitude}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, latitude: text }))}
                  keyboardType="numeric"
                />
                
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="경도"
                  value={formData.longitude}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, longitude: text }))}
                  keyboardType="numeric"
                />
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="반지름 (미터)"
                value={formData.radius}
                onChangeText={(text) => setFormData(prev => ({ ...prev, radius: text }))}
                keyboardType="numeric"
              />
              
              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    formData.building_type === 'rectangle' && styles.typeButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, building_type: 'rectangle' }))}
                >
                  <Text style={[
                    styles.typeButtonText,
                    formData.building_type === 'rectangle' && styles.typeButtonTextActive
                  ]}>사각형</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    formData.building_type === 'polygon' && styles.typeButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, building_type: 'polygon' }))}
                >
                  <Text style={[
                    styles.typeButtonText,
                    formData.building_type === 'polygon' && styles.typeButtonTextActive
                  ]}>다각형</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.sectionTitle}>좌표</Text>
              {formData.coordinates.map((coord, index) => (
                <View key={index} style={styles.coordinateRow}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="위도"
                    value={coord.latitude}
                    onChangeText={(text) => updateCoordinate(index, 'latitude', text)}
                    keyboardType="numeric"
                  />
                  
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="경도"
                    value={coord.longitude}
                    onChangeText={(text) => updateCoordinate(index, 'longitude', text)}
                    keyboardType="numeric"
                  />
                  
                  {formData.coordinates.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeCoordinate(index)}
                    >
                      <Text style={styles.removeButtonText}>삭제</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              
              <TouchableOpacity style={styles.addCoordinateButton} onPress={addCoordinate}>
                <Text style={styles.addCoordinateButtonText}>+ 좌표 추가</Text>
              </TouchableOpacity>
              
              <TextInput
                style={styles.input}
                placeholder="설명 (선택사항)"
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
              />
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmit}
              >
                <Text style={styles.saveButtonText}>
                  {editingBuilding ? '수정' : '추가'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  buildingCard: {
    backgroundColor: Colors.white,
    margin: 10,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buildingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  buildingName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    flex: 1,
  },
  buildingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  buildingInfo: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: Colors.light.text,
  },
  formScroll: {
    maxHeight: 400,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.icon,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: Colors.light.text,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  halfInput: {
    flex: 1,
  },
  campusButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.icon,
    alignItems: 'center',
  },
  campusButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  campusButtonText: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  campusButtonTextActive: {
    color: Colors.white,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.icon,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  typeButtonText: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: Colors.light.text,
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removeButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  addCoordinateButton: {
    backgroundColor: Colors.success,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  addCoordinateButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.gray,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 50,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 50,
  },
});
