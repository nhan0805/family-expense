import {describe,expect,it} from 'vitest';import {aiResponseSchema,dashboardSummaryResponseSchema,transactionSearchResponseSchema} from './ai';
const base={date:'2026-08-25',description:'Mua sữa',amount:450000,transactionType:'Chi tiêu',status:'Thực tế',purposeId:null,purposeName:'Con cái',expenseTypeId:null,expenseTypeName:'Thực phẩm',paymentMethodId:null,paymentMethodName:'Thẻ tín dụng',confidence:.95,warnings:[]};
describe('Gemini structured response',()=>{it('nhận JSON hợp lệ',()=>expect(aiResponseSchema.parse({suggestion:base}).suggestion.amount).toBe(450000));it('nhận thiếu amount có cảnh báo',()=>expect(aiResponseSchema.parse({suggestion:{...base,amount:null,warnings:['Thiếu số tiền']}}).suggestion.amount).toBeNull());it('từ chối JSON lỗi',()=>expect(()=>aiResponseSchema.parse({suggestion:{...base,confidence:2}})).toThrow());it('từ chối danh mục sai kiểu',()=>expect(()=>aiResponseSchema.parse({suggestion:{...base,purposeId:12}})).toThrow())});

describe('AI dashboard và tìm kiếm',()=>{
  const filters={query:'sữa',transactionType:'Chi tiêu' as const,status:'Thực tế' as const,purposeId:'11111111-1111-4111-8111-111111111111',expenseTypeId:null,paymentMethodId:null,month:8,year:2026,dateFrom:null,dateTo:null,sort:'date-desc' as const};
  it('nhận bộ lọc tìm kiếm có cấu trúc',()=>expect(transactionSearchResponseSchema.parse({filters,explanation:'Đã lọc chi tiêu tháng 8'}).filters.month).toBe(8));
  it('từ chối ID danh mục không phải UUID',()=>expect(()=>transactionSearchResponseSchema.parse({filters:{...filters,purposeId:'p1'},explanation:''})).toThrow());
  it('nhận tóm tắt Dashboard và tối đa bốn điểm',()=>expect(dashboardSummaryResponseSchema.parse({summary:'Chi tiêu ổn định.',highlights:['Ăn uống là nhóm lớn nhất']}).highlights).toHaveLength(1));
  it('từ chối tóm tắt rỗng',()=>expect(()=>dashboardSummaryResponseSchema.parse({summary:'',highlights:[]})).toThrow());
});
